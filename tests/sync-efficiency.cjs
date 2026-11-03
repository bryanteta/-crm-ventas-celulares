// Deterministic protocol checks; counters measure bridge submissions, not production billing.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date('2030-11-01T18:00:00Z') });
    await page.addInitScript(() => {
      window.requests = [];
      const base = { id:'one',client:'Cliente',phone:'+50371234567',model:'Galaxy',channel:'WhatsApp',payment:'Contado',event:'Seguimiento',when:'2030-11-01T16:00',state:'Pendiente',contactProfile:'',notes:'',createdById:'ana',createdByName:'Ana',createdAt:'2030-10-01T00:00:00Z' };
      localStorage.setItem('lunivo-active-account-v1','alice');
      if (!localStorage.getItem('lunivo-account-v1:alice')) localStorage.setItem('lunivo-account-v1:alice',JSON.stringify({records:[base,{...base,id:'late',client:'Anterior',when:'2030-10-31T10:00'},{...base,id:'future',client:'Próximo',when:'2030-11-03T10:00'}],outbox:{}}));
      localStorage.setItem('lunivo-profiles-account-v1:alice',JSON.stringify({records:[{id:'ana',name:'Ana',active:true}],outbox:{}}));
      localStorage.setItem('lunivo-selected-profile-v1:alice','ana');
      window.CrmAndroid = { postMessage(raw) {
        const request=JSON.parse(raw); requests.push(request);
        if (request.type==='cloudState') queueMicrotask(()=>dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudState',configured:true,uid:'alice',email:'alice@example.test'}})));
        else if (!request.type.startsWith('cloud')) queueMicrotask(()=>this.onmessage({data:JSON.stringify({type:'status',enabled:true,exact:true,scheduled:0})}));
      }};
      window.snapshot = (cache=false) => {
        for(const [store,type] of [[LunivoStore,'cloudSnapshot'],[LunivoProfiles,'cloudProfilesSnapshot']]) dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type,uid:'alice',fromCache:cache,documents:store.records().map(record=>({id:record.id,record,revision:'remote',deleted:false,committed:!cache}))}}));
      };
    });
    await page.goto('http://127.0.0.1:8000/#dashboard');
    for (const section of ['#today-items','#priority-items','#upcoming-items']) assert.match(await page.locator(section).textContent(), /Registrado por: Ana/);
    await page.evaluate(()=>{
      const rows=LunivoStore.records(); delete rows[1].createdByName; delete rows[1].createdById; delete rows[1].createdAt; LunivoStore.save(rows); LunivoApp.reload();
    });
    assert.match(await page.locator('#priority-items').textContent(),/Sin usuario registrado/);
    await page.evaluate(()=>snapshot(true));
    await page.clock.fastForward(1000);
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').length),0,'cache-only data must not trigger a cloud write before connectivity is confirmed');
    await page.evaluate(()=>snapshot(false)); await page.clock.fastForward(1000);
    const initial = await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush'));
    assert.equal(initial.length,1);
    // Hold acknowledgements: state requests, snapshots and duplicate save events must not resubmit.
    for(let i=0;i<5;i++) { await page.evaluate(()=>{dispatchEvent(new Event('lunivo-local-save'));dispatchEvent(new Event('crm-native-refresh'));snapshot(false);}); await page.clock.fastForward(1000); }
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').length),1);
    const stateCount=await page.evaluate(()=>requests.filter(r=>r.type==='cloudState').length);
    await page.clock.fastForward(120000);
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudState').length),stateCount,'there must be no periodic state polling');
    await page.locator('nav a[href="#ajustes"]').click();
    await page.locator('#cloud-open').click();
    await page.locator('#account-sync').click(); await page.clock.fastForward(1000);
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').length),2,'manual retry can recover an unacknowledged operation');
    await page.locator('#account-close').click();
    await page.evaluate(()=>dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudError',message:'Error de prueba'}})));
    await page.clock.fastForward(5000);
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').length),2,'errors must not cause a write retry loop');
    await page.evaluate(()=>dispatchEvent(new Event('online'))); await page.clock.fastForward(1000);
    assert.equal(await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').length),3,'reconnection retries durable pending data');
    // Large durable queues must drain in bounded batches without dropping or duplicating a row.
    await page.evaluate(()=>{
      for (const op of LunivoStore.pending()) dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudAck',uid:'alice',id:op.id,revision:op.revision}}));
      const original=LunivoStore.records()[0];
      const extra=Array.from({length:205},(_,i)=>({...original,id:'bulk-'+i,client:'Cliente '+i}));
      LunivoStore.save([...LunivoStore.records(),...extra]); dispatchEvent(new Event('lunivo-local-save'));
      requests.length=0;
    });
    const delivered=[];
    for(const expected of [100,100,5]){
      await page.clock.fastForward(1000);
      const operations=await page.evaluate(()=>requests.filter(r=>r.type==='cloudFlush').at(-1).operations);
      assert.equal(operations.length,expected);
      delivered.push(...operations.map(op=>op.id));
      await page.evaluate(ops=>{for(const op of ops) dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudAck',uid:'alice',id:op.id,revision:op.revision}}));},operations);
    }
    assert.equal(new Set(delivered).size,205); assert.equal(await page.evaluate(()=>LunivoStore.pending().length),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: autor en las tres secciones de Inicio, legado sin autor, caché sin escrituras, una revisión en vuelo, sin sondeo periódico, reintento manual/reconexión y sin bucle ante errores y 205 operaciones en lotes sin duplicados');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
