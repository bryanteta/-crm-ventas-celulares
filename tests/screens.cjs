// Ejecutar con el servidor local activo: node tests/screens.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    for (const width of [320,390,768,1440]) {
      const context=await browser.newContext({viewport:{width,height:900}});
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const checkScreen=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
      assert.equal((await page.goto('http://127.0.0.1:8000')).status(),200);
      await checkScreen();assert.equal(await page.locator('#registro').isVisible(),false);
      await page.locator('nav a[href="#registro"]').click();await page.locator('#form').waitFor();
      await page.locator('button[type=submit]').click();assert.equal(await page.locator('#form').evaluate(f=>f.checkValidity()),false);
      for(const [name,value] of Object.entries({client:'Cliente de prueba',phone:'50371234567',model:'Samsung',when:'2026-12-01T10:00',notes:'Prueba de integridad'}))await page.locator(`[name=${name}]`).fill(value);
      await checkScreen();await page.locator('button[type=submit]').click();await page.locator('#items .row').waitFor();
      await page.reload();await page.locator('#items .row').waitFor();assert.equal(await page.locator('#items .row').count(),1);
      assert.equal(await page.getByRole('link',{name:'Abrir WhatsApp'}).getAttribute('href'),'https://wa.me/50371234567');
      await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=model]').fill('Cambio cancelado');await page.getByRole('button',{name:'Cancelar edición'}).click();await page.locator('#items .row').waitFor();assert.match(await page.locator('#items .row').textContent(),/Samsung/);
      await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('[name=model]').fill('Modelo actualizado');await page.locator('[name=when]').fill('2026-12-02T11:00');await page.getByRole('button',{name:'Guardar cambios'}).click();await page.locator('#items .row').waitFor();assert.match(await page.locator('#items .row').textContent(),/Modelo actualizado/);
      await page.locator('nav a[href="#agenda"]').click();
      await page.locator('#listado').waitFor({state:'hidden'});
      await page.locator('#calendar-today').click();
      // Navigate from current month to the record's month, including year boundaries.
      const offset=await page.evaluate(()=>{const d=new Date();return (2026-d.getFullYear())*12+11-d.getMonth()});
      for(let i=0;i<Math.abs(offset);i++)await page.locator(offset>0?'#next-month':'#prev-month').click();
      await page.locator('#next-month').click();assert.match(await page.locator('#month-title').textContent(),/enero de 2027/);await page.locator('#prev-month').click();await page.getByRole('button',{name:'2026-12-02, 1 contactos',exact:true}).click();
      assert.equal(await page.locator('#day-items .row').count(),1);
      assert.match(await page.locator('#day-items').textContent(),/Modelo actualizado/);await checkScreen();
      await page.getByRole('button',{name:'2026-12-03, 0 contactos',exact:true}).click();
      assert.equal(await page.locator('#day-items .row').count(),0);
      await page.locator('#add-for-day').click();assert.equal(await page.locator('[name=when]').inputValue(),'2026-12-03T09:00');
      await page.locator('nav a[href="#listado"]').click();await page.locator('#listado').waitFor();
      await page.locator('#items').getByLabel('Estado de Cliente de prueba',{exact:true}).selectOption('Completado');await page.locator('#filter').selectOption('Pendiente');assert.equal(await page.locator('#items .row').count(),0);await page.locator('#filter').selectOption('Todos');
      await page.locator('#search').fill('inexistente');assert.equal(await page.locator('#items .row').count(),0);await page.locator('#search').fill('actualizado');assert.equal(await page.locator('#items .row').count(),1);await checkScreen();
      await page.locator('nav a[href="#dashboard"]').click();assert.equal(await page.locator('#npending').textContent(),'0');assert.equal(await page.locator('#nclients').textContent(),'1');
      await page.locator('nav a[href="#listado"]').click();await page.locator('#listado').waitFor();page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Eliminar',exact:true}).click();assert.equal(await page.locator('#items .row').count(),1);
      page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Eliminar',exact:true}).click();assert.equal(await page.locator('#items .row').count(),0);await page.reload();assert.equal(await page.locator('#items .row').count(),0);
      await page.evaluate(()=>{const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T23:59';const d=new Date(),past=new Date(d),future=new Date(d);past.setDate(d.getDate()-1);future.setDate(d.getDate()+1);const base={phone:'50371234567',model:'Equipo',channel:'WhatsApp',payment:'Contado',event:'Seguimiento',state:'Pendiente',notes:''};localStorage.setItem('crm-telefonos-seguimientos-v1',JSON.stringify([{...base,id:'today',client:'Cita hoy',when:key(d)},{...base,id:'late',client:'Cita vencida',when:key(past)},{...base,id:'future',client:'Cita futura',when:key(future)},{...base,id:'done',client:'Ya completado',when:key(d),state:'Completado'}]))});
      await page.goto('http://127.0.0.1:8000/#dashboard');await page.reload();
      assert.match(await page.locator('#today-items').textContent(),/Cita hoy/);assert.doesNotMatch(await page.locator('#today-items').textContent(),/Ya completado/);
      assert.match(await page.locator('#priority-items').textContent(),/Cita vencida/);assert.match(await page.locator('#upcoming-items').textContent(),/Cita futura/);
      assert.equal(await page.locator('#ntoday').textContent(),'1');assert.equal(await page.locator('#nlate').textContent(),'1');await checkScreen();
      await page.locator('#today-items a').click();await page.locator('#agenda').waitFor();assert.equal(await page.locator('#day-items .row').count(),2);
      await page.evaluate(()=>localStorage.setItem('crm-telefonos-seguimientos-v1','[null,{"when":"bad"}]'));await page.reload();await checkScreen();assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px: navegación, validación, crear, persistir, cancelar edición, editar/reprogramar, calendario, seleccionar día, programar por fecha, completar, filtrar, buscar, contadores, cancelar eliminación, eliminar y datos dañados`);
      await context.close();
    }
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
