const {chromium}=require('playwright'),a=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:915}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await require('./profile-fixture.cjs').installProfile(page);
  await page.addInitScript(()=>{
   sessionStorage.setItem('lunivo-intro-v1','seen');
   const models=['iPhone 16','Galaxy S24','iPhone 8','Galaxy S9','iPhone 11','Galaxy S10'];
   localStorage.setItem('lunivo-suite-preview-v1:local',JSON.stringify({sales:[],offers:models.map((model,i)=>({id:'q'+i,supplier:i%2?'Samuel':'Split',ownerId:i%2?'samuel':i===2?'javier':'saul',model,capacity:'128 GB',quantity:2,price:10000+i*10000,date:'2026-11-08',source:'manual'})),inventory:models.map((model,i)=>({id:'s'+i,model,ownerId:'lunivo',cost:10000+i*10000,quantity:2}))}));
  });
  await page.route('**/assets/provider-bootstrap.json',r=>r.fulfill({status:404,body:''}));
  await page.goto('http://127.0.0.1:8000/#ventas/proveedores');
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lunivo-suite-preview-v1:local'))),before=await read();
  const names=selector=>page.locator(selector+' .device-card-copy h4').allTextContents();
  const ascending=['Galaxy S9','Galaxy S10','Galaxy S24','iPhone 8','iPhone 11','iPhone 16'];
  a.equal(await page.locator('#offer-sort').isVisible(),true);
  a.equal(await page.locator('#offer-sort').inputValue(),'model');
  a.deepEqual(await names('#offers-list'),ascending);
  await page.locator('#offer-sort').selectOption('model-desc');
  a.deepEqual(await names('#offers-list'),[...ascending].reverse());
  await page.locator('[data-provider-family=iphone]').click();
  a.deepEqual(await names('#offers-list'),['iPhone 16','iPhone 11','iPhone 8']);
  await page.locator('#provider-directory [data-inventory-provider=split]').click();
  await page.locator('[data-provider-owner=saul]').waitFor();
  a.deepEqual(await names('#offers-list'),['iPhone 16','iPhone 11','iPhone 8']);
  await page.locator('[data-provider-owner=saul]').click();
  a.deepEqual(await names('#offers-list'),['iPhone 16','iPhone 11']);
  await page.locator('#offer-sort').selectOption('model');
  a.deepEqual(await names('#offers-list'),['iPhone 11','iPhone 16']);
  await require('./catalog.cjs').options(page);
  await page.locator('#provider-clear-filters').click();
  a.equal(await page.locator('#offer-sort').inputValue(),'model');
  a.deepEqual(await names('#offers-list'),['iPhone 11','iPhone 16']);
  await page.locator('#registered-inventory-link').click();
  await page.locator('#sales-inventory').waitFor();
  a.equal(await page.locator('#inventory-sort').isVisible(),true);
  a.deepEqual(await names('#inventory-list'),ascending);
  await page.locator('#inventory-sort').selectOption('model-desc');
  a.deepEqual(await names('#inventory-list'),[...ascending].reverse());
  await page.locator('[data-inventory-family=samsung]').click();
  a.deepEqual(await names('#inventory-list'),['Galaxy S24','Galaxy S10','Galaxy S9']);
  await page.locator('#inventory-sort').selectOption('model');
  a.deepEqual(await names('#inventory-list'),['Galaxy S9','Galaxy S10','Galaxy S24']);
  for(const hash of ['#ventas/proveedores','#ventas/inventario']){
   await page.evaluate(h=>location.hash=h,hash);
   const select=page.locator(hash.endsWith('proveedores')?'#offer-sort':'#inventory-sort');
   await select.waitFor();
   for(const width of [320,412,840]){await page.setViewportSize({width,height:915});a.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));a.equal(await select.isVisible(),true);}
  }
  a.deepEqual(await read(),before,'sorting and filtering must not rewrite stock, prices or sales');
  a.deepEqual(errors,[]);
  console.log('PASS modelo numérico ascendente/descendente, control visible, proveedores/dueños/familias y Mis equipos, precios/stock intactos y sin desbordamiento');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
