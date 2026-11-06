const {chromium}=require('playwright'),a=require('node:assert/strict');
const artifact=require('./artifacts.cjs').path;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await require('./profile-fixture.cjs').installProfile(page);
  await page.addInitScript(()=>{
   sessionStorage.setItem('lunivo-intro-v1','seen');window.messages=[];
   window.CrmAndroid={postMessage(raw){const r=JSON.parse(raw);messages.push(r);if(r.type==='appearance')return;queueMicrotask(()=>{if(r.type==='cloudState')dispatchEvent(new CustomEvent('lunivo-cloud',{detail:{type:'cloudState',configured:false,uid:null,email:''}}));else if(r.type.startsWith('launchSound'))this.onmessage({data:JSON.stringify({type:'launchSoundStatus',enabled:false,available:true})});else if(r.type==='receiptExport')window.exported=r;else this.onmessage({data:JSON.stringify({type:'status',enabled:true,exact:true,scheduled:0})});});}};
  });
  await page.route('**/assets/provider-bootstrap.json',r=>r.fulfill({json:{version:1,checkedAt:new Date().toISOString(),providers:{samuel:{rows:[],total:0},split:{rows:[],total:0}}}}));
  const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lunivo-suite-preview-v1:local')));
  await page.goto('http://127.0.0.1:8000/#ventas');
  await page.locator('#sales-summary .own-stock-access').getByRole('link',{name:'Ver mis equipos',exact:true}).click();await page.locator('#inventory-add').click();
  await page.locator('#stock-form').waitFor();a.equal(await page.locator('#stock-form [name=ownerId]').inputValue(),'lunivo');
  for(const [name,value]of Object.entries({brand:'Apple',model:'iPhone 14 · 128 GB · Negro',quantity:'2',cost:'350'}))await page.locator('#stock-form [name='+name+']').fill(value);
  await page.locator('#stock-form [type=submit]').click();let d=await data();a.equal(d.inventory.length,1);a.equal(d.inventory[0].ownerId,'lunivo');a.equal(d.inventory[0].quantity,2);a.match(await page.locator('#inventory-list').textContent(),/Lunivo/);
  await page.getByRole('link',{name:'Inventario',exact:true}).click();await page.locator('#sales-providers').waitFor();a.match(await page.locator('#provider-results').textContent(),/^0 equipo/,'own inventory does not enter supplier counts');a.equal(await page.locator('#inventory-switcher').isVisible(),true);
  await page.locator('#suite-settings').click();await require('./settings-category.cjs').open(page,'app');
  const select=page.locator('#appearance-mode');await select.selectOption('dark');
  a.equal(await page.locator('html').getAttribute('data-theme'),'dark');a.equal(await page.evaluate(()=>localStorage.getItem('lunivo-appearance-v1')),'dark');
  a.equal(await page.locator('aside [data-theme-logo]').getAttribute('src'),'assets/lunivo-mark-dark.png');
  await page.waitForFunction(()=>document.querySelector('aside [data-theme-logo]').naturalWidth>0);
  a.equal(await page.evaluate(()=>messages.filter(m=>m.type==='appearance').at(-1).dark),true);
  await page.screenshot({path:artifact('lunivo-1.5.8-ajustes-oscuro.png'),animations:'disabled'});
  await page.reload();await require('./settings-category.cjs').open(page,'app');a.equal(await select.inputValue(),'dark');a.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  const before=await data();await page.evaluate(()=>{window.normalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};});await select.selectOption('light');a.equal(await select.inputValue(),'dark');a.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.evaluate(()=>Storage.prototype.setItem=window.normalSet);a.deepEqual(await data(),before);
  await select.selectOption('system');await page.emulateMedia({colorScheme:'light'});a.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');a.equal(await page.locator('html').getAttribute('data-theme'),'dark');await select.selectOption('light');await page.emulateMedia({colorScheme:'dark'});a.equal(await page.locator('html').getAttribute('data-theme'),'light');await select.selectOption('dark');
  await page.goto('http://127.0.0.1:8000/#ventas/inventario?owner=lunivo');await page.locator('#inventory-list > .inventory-item > summary').click();await page.locator('#inventory-list').getByRole('button',{name:'Vender',exact:true}).click();await page.locator('#sale-form [name=client]').fill('Cliente prueba');await page.locator('#sale-form [name=price]').fill('450');await page.locator('#sale-confirm').click();await page.getByRole('button',{name:'Preparar garantía',exact:true}).click();
  for(const key of ['brand','capacity','color','condition','battery','physical']){const input=page.locator('#receipt-'+key);if(key==='condition')await input.selectOption('');else await input.fill('');}
  const beforeInvalid=await data();await page.locator('#warranty-save').click();
  a.deepEqual(await data(),beforeInvalid,'invalid warranty must not save or consume a sequence');a.equal(await page.locator('#receipt-brand').evaluate(e=>e===document.activeElement),true);a.equal(await page.locator('#warranty-form [aria-invalid=true]').count(),6);a.match(await page.locator('#warranty-validation').textContent(),/Marca, Capacidad, Color/);
  a.equal(await page.locator('#receipt-serials').getAttribute('aria-invalid'),null,'IMEI stays optional');
  await page.screenshot({path:artifact('lunivo-1.5.8-garantia-pendientes.png'),animations:'disabled'});
  await page.locator('#warranty-validation').getByRole('button',{name:'Estado físico',exact:true}).click();a.equal(await page.locator('#receipt-physical').evaluate(e=>e===document.activeElement),true);
  for(const [key,value]of Object.entries({brand:'Apple',capacity:'128 GB',color:'Negro',battery:'100%',physical:'Sin daños visibles'}))await page.locator('#receipt-'+key).fill(value);
  await page.locator('#receipt-condition').selectOption('Seminuevo');a.equal(await page.locator('#warranty-form [aria-invalid=true]').count(),0);
  await page.locator('#warranty-payment-details>summary').click();await page.locator('#warranty-payment').selectOption('Tasa cero');await page.locator('#warranty-payment-details>summary').click();await page.locator('#warranty-save').click();a.equal(await page.locator('#warranty-payment-details').getAttribute('open'),'');a.equal(await page.locator('#warranty-bank').evaluate(e=>e===document.activeElement),true);
  await page.locator('#warranty-bank').fill('BAC');await page.locator('#warranty-save').click();a.equal(await page.locator('#warranty-months').evaluate(e=>e===document.activeElement),true);await page.locator('#warranty-months').fill('12');await page.locator('#warranty-phone').fill('incorrecto');await page.locator('#warranty-save').click();a.equal(await page.locator('#warranty-phone').evaluate(e=>e===document.activeElement),true);await page.locator('#warranty-phone').fill('');await page.locator('#warranty-save').click();await page.locator('#warranty-preview').waitFor();
  a.equal(await page.locator('#warranty-preview').evaluate(e=>getComputedStyle(e.shadowRoot.querySelector('.sheet')).color),'rgb(32, 51, 77)');await page.locator('#warranty-export').click();a.equal(await page.evaluate(()=>exported.document.total),'$450.00');a.deepEqual((await data()).sales[0].receipt.serials,[]);a.equal((await data()).inventory[0].quantity,1);
  await page.getByRole('link',{name:'Inventario',exact:true}).click();await page.locator('#registered-inventory-link').click();await page.screenshot({path:artifact('lunivo-1.5.8-mis-equipos-oscuro.png'),animations:'disabled'});
  for(const [width,height]of [[320,740],[384,832],[412,915],[690,840],[840,920],[960,840],[915,412]]){
   await page.setViewportSize({width,height});for(const route of ['#ventas/inventario?owner=lunivo','#ventas/proveedores','#ventas/nueva','#ajustes','#dashboard','#agenda']){await page.goto('http://127.0.0.1:8000/'+route);if(route==='#ajustes')for(const category of ['account','inventory','notifications','app']){await require('./settings-category.cjs').open(page,category);a.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+category);}a.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+route);}
  }
  await page.setViewportSize({width:840,height:920});await page.goto('http://127.0.0.1:8000/#ventas');await page.locator('#module-open').click();await page.screenshot({path:artifact('lunivo-1.5.8-modulos-oscuro-fold.png'),animations:'disabled'});await page.locator('#module-close').click();
  await page.goto('http://127.0.0.1:8000/#dashboard');const contrast=await page.locator('#primary-action').evaluate(e=>{const style=getComputedStyle(e),luma=color=>{const rgb=color.match(/[0-9.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const fg=luma(style.color),bg=luma(style.backgroundColor);return(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)});a.ok(contrast>=4.5,'primary action contrast '+contrast);await page.screenshot({path:artifact('lunivo-1.5.8-follows-oscuro-fold.png'),animations:'disabled'});
  a.deepEqual(errors,[]);a.equal((await data()).inventory[0].quantity,1);console.log('PASS apariencia e inventario propio: acceso directo, dueño Lunivo, separación de proveedores, venta/descuento, tema persistente/sistema/fallo, logo, siete tamaños y barras nativas solicitadas');console.log('PASS garantía guiada: lista y foco del campo, errores junto al dato, abrir pago, banco/meses/teléfono, IMEI opcional, fallo sin escrituras y PDF legible en oscuro');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
