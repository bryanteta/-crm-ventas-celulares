const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:412,height:915},timezoneId:'America/El_Salvador'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await require('./profile-fixture.cjs').installProfile(page);
 await page.clock.install({time:new Date('2026-10-31T18:00:00Z')});
 await page.addInitScript(()=>{
  window.nativeMessages=[];
  window.CrmAndroid={postMessage(raw){const r=JSON.parse(raw);nativeMessages.push(r);queueMicrotask(()=>{if(r.type==='cloudState')dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudState',configured:false,uid:null,email:''}}));else this.onmessage({data:JSON.stringify({type:'status',request:r.type,enabled:true,exact:true,scheduled:0})});});}};
  if(!localStorage.getItem('crm-telefonos-seguimientos-v1')){
   const base={phone:'+50370000001',model:'Galaxy',channel:'WhatsApp',payment:'Contado',event:'Seguimiento',state:'Pendiente',notes:'',contactProfile:'',createdById:'test-user',createdByName:'Usuario de pruebas',createdAt:'2026-10-28T18:00:00Z'};
   localStorage.setItem('crm-telefonos-seguimientos-v1',JSON.stringify([{...base,id:'original',client:'Cliente original',when:'2026-10-31T16:00'},{...base,id:'history',client:'Historial conservado',brand:'Split',phone:'+50370000002',when:'2026-10-31T17:00'},{...base,id:'explicit',client:'Otro cliente',brand:'Lunivo',phone:'+50370000003',when:'2026-11-01T09:00'}]));
   localStorage.setItem('lunivo-active-brand-v1:local','Split');
  }
 });
 await page.goto('http://127.0.0.1:8000/#dashboard');
 assert.equal(await page.locator('#brand-filter,#brand-switcher,#form [name=brand],[data-brand-target]').count(),0);
 assert.doesNotMatch(await page.locator('body').innerText(),/Split|Marca que estás viendo/);
 assert.match(await page.locator('#view-title').textContent(),/Lunivo/);
 assert.equal(await page.locator('#nclients').textContent(),'3');assert.equal(await page.locator('#npending').textContent(),'3');assert.equal(await page.locator('#ntoday').textContent(),'2');
 assert.match(await page.locator('#today-items').textContent(),/Cliente original/);assert.match(await page.locator('#today-items').textContent(),/Historial conservado/);
 assert.equal(await page.evaluate(()=>nativeMessages.filter(r=>r.type==='sync').at(-1).records.length),3);
 const before=await page.evaluate(()=>localStorage.getItem('crm-telefonos-seguimientos-v1'));
 await page.locator('nav a[href="#listado"]').click();assert.equal(await page.locator('#items .row').count(),3);
 await page.locator('#search').fill('Historial');assert.equal(await page.locator('#items .row').count(),1);await page.locator('#search').fill('');
 await page.locator('nav a[href="#agenda"]').click();await page.getByRole('button',{name:'2026-10-31, 2 contactos',exact:true}).click();assert.equal(await page.locator('#day-items .row').count(),2);
 assert.equal(await page.evaluate(()=>localStorage.getItem('crm-telefonos-seguimientos-v1')),before,'reading all historical rows must not rewrite/migrate data');
 await page.evaluate(()=>dispatchEvent(new CustomEvent('crm-open-followup',{detail:'history'})));await page.locator('#day-items .focused-record').waitFor();assert.match(await page.locator('#day-items .focused-record').textContent(),/Historial conservado/);
 await page.locator('nav a[href="#listado"]').click();
 const history=page.locator('#items .row').filter({hasText:'Historial conservado'});
 const original=await page.evaluate(()=>LunivoApp.records().find(r=>r.id==='history'));
 await history.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#form [name=notes]').fill('Editado en Lunivo');await page.locator('#form [type=submit]').click();
 const updated=await page.evaluate(()=>LunivoApp.records().find(r=>r.id==='history'));
 for(const key of ['id','brand','createdById','createdByName','createdAt'])assert.equal(updated[key],original[key]);
 assert.equal(updated.notes,'Editado en Lunivo');
 await page.locator('nav a[href="#registro"]').click();
 for(const [field,value]of Object.entries({client:'Nuevo Lunivo',phone:'71234567',model:'Galaxy',when:'2026-11-01T10:00'}))await page.locator(`#form [name=${field}]`).fill(value);
 await page.locator('#form [type=submit]').click();await page.locator('#listado').waitFor();
 const added=await page.evaluate(()=>LunivoApp.records().find(r=>r.client==='Nuevo Lunivo'));assert.equal(Object.hasOwn(added,'brand'),false);assert.equal(added.createdByName,'Usuario de pruebas');
 await page.reload();assert.equal(await page.locator('#items .row').count(),4);assert.doesNotMatch(await page.locator('body').innerText(),/Split/);
 await page.locator('#items').getByLabel('Estado de Nuevo Lunivo',{exact:true}).selectOption('Completado');
 await page.locator('#filter').selectOption('Completado');assert.equal(await page.locator('#items .row').count(),1);await page.locator('#filter').selectOption('Todos');
 await page.locator('#items .row').filter({hasText:'Historial conservado'}).getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#form [name=notes]').fill('No guardar aún');
 const saved=await page.evaluate(()=>localStorage.getItem('crm-telefonos-seguimientos-v1'));
 await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError')}});
 await page.locator('#form [type=submit]').click();assert.match(await page.locator('#notice').textContent(),/No se pudieron guardar/);assert.equal(await page.evaluate(()=>localStorage.getItem('crm-telefonos-seguimientos-v1')),saved);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet});await page.getByRole('button',{name:'Cancelar edición',exact:true}).click();
 for(const[width,height]of[[320,840],[412,915],[440,956],[840,920],[915,412]]){await page.setViewportSize({width,height});for(const view of['#dashboard','#registro','#listado','#agenda','#ajustes']){await page.locator(`nav a[href="${view}"]`).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width} ${view}`);}}
 assert.deepEqual(errors,[]);console.log('PASS solo Lunivo: sin marcas en interfaz, historial y preferencias antiguas sin ocultar registros, edición conserva autor/metadatos, nuevos registros sin campo de marca, agenda/contadores/avisos completos, recarga y fallo de almacenamiento; 5 tamaños');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
