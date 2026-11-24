// Bidirectional web prices: the real catalog Worker (in Node) is the single
// source shared by the web administration and the app's native bridge.
const {chromium}=require('playwright'),a=require('node:assert/strict'),core=require('../feeds-core.js'),catalog=require('../scripts/catalog-core.cjs'),custom=require('../catalogo/customization-core.js');
const token='fixture-admin-key-for-app-'.repeat(2);
const samuel={c:JSON.stringify({columnas:['Modelo','Color','Capacidad','Batería','Categoría','Precio Venta','Observaciones'],filas:[['iPhone 13','Negro','128GB','100%','A+','$350.00',''],['iPhone 13','Negro','128GB','100%','A+','$350.00','']],ahora:Date.now(),leido:Date.now()})};
const split={actualizado:new Date().toISOString(),moneda:'USD',total:2,items:[{id:'s1',origen:'SPLIT',modelo:'IPHONE 13 NORMAL 128GB',detalle:'128GB · Seminuevo',color:'Rojo',precio:345},{id:'j1',origen:'JAVIER',modelo:'iPhone 14 · 128GB',detalle:'128GB',color:'Azul',precio:420}]};
(async()=>{
 const {default:worker,CatalogStore}=await import('../workers/catalog/worker.mjs');
 const snapshot={version:1,checkedAt:new Date().toISOString(),providers:{samuel:core.samuelApi(samuel),split:core.split(split)}},published=catalog.buildCatalog(snapshot);
 const rows=new Map([['public',JSON.stringify(published)]]),sql={exec(q,...args){if(q.startsWith('CREATE'))return {};if(q.startsWith('SELECT'))return {toArray:()=>rows.has(args[0])?[{data:rows.get(args[0])}]:[]};rows.set(args[0],args[1]);return {};}};
 const env={CATALOG_ADMIN_TOKEN:token},object=new CatalogStore({storage:{sql},waitUntil:()=>{}},env),bindings={CATALOG:{idFromName:()=>1,get:()=>object}};object.refresh=async()=>Boolean(object.latest);
 const call=async(method,path,body,key)=>{const r=await worker.fetch(new Request('https://fixture'+path,{method,headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body||undefined}),bindings);return {status:r.status,body:await r.text()};};
 const live=async()=>JSON.parse((await call('GET','/customizations.json')).body);
 const product=model=>published.products.find(p=>p.model===model&&p.sourceInitials.join('')===(model==='iPhone 14'?'J':'T'));
 const webEdit=async(p,patch)=>{const key=await custom.key(p),current=(await live()).overrides[key]||null;const r=await call('PUT','/admin/customizations',JSON.stringify({key,productId:p.id,expectedRevision:(await live()).revision,expectedEdit:current,patch}),token);a.equal(r.status,200,r.body);return key;};
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const p=await b.newPage({viewport:{width:412,height:915}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await require('./profile-fixture.cjs').installProfile(p);
  await p.exposeFunction('workerCall',call);
  await p.addInitScript(({samuel,split})=>{window.bridgeLog=[];window.catalogKey='';window.LunivoInventoryAndroid={async postMessage(raw){const r=JSON.parse(raw);bridgeLog.push(r.type);let result={id:r.id,scope:r.scope,ok:true};
   try{
    if(r.type==='state')result.configured=true;
    else if(r.type==='refresh')result.body=JSON.stringify(r.provider==='samuel'?samuel:split);
    else if(r.type==='catalogState')result.configured=Boolean(catalogKey);
    else if(r.type==='catalogSaveKey'){const s=await workerCall('GET','/admin/session',null,r.key);if(s.status!==200)throw Error('La clave del catálogo web no es válida. No se guardó.');catalogKey=r.key;result.configured=true;}
    else if(r.type==='catalogClearKey'){catalogKey='';result.configured=false;}
    else if(r.type==='catalogRead'){const s=await workerCall('GET','/customizations.json');result.body=s.body;}
    else if(r.type==='catalogEdit'){if(!catalogKey)throw Error('Guarda la clave del catálogo web en Ajustes para cambiar precios.');if(!['PUT','DELETE'].includes(r.method))throw Error('Operación no permitida.');const s=await workerCall(r.method,'/admin/customizations',r.body,catalogKey);result.status=s.status;result.body=s.body;}
    else throw Error('unknown');
   }catch(e){result={id:r.id,scope:r.scope,ok:false,message:e.message};}
   setTimeout(()=>this.onmessage({data:JSON.stringify(result)}),0);}};},{samuel,split});
  await p.route('**/assets/provider-bootstrap.json',r=>r.fulfill({json:snapshot}));
  // 1. A price saved in the web administration reaches the app cards and the sale suggestion.
  const iphone13=product('iPhone 13'),iphone14=product('iPhone 14');a(iphone13&&iphone14,'fixture products are published');
  const key13=await webEdit(iphone13,{priceCents:49900,images:[{url:'https://cdn.example.com/front.jpg',width:1200,height:1200,label:'Frente'}]});
  await p.goto('http://127.0.0.1:8000/#ventas/proveedores');if(await p.locator('#launch-intro').isVisible())await p.locator('#launch-skip').click();
  await p.waitForFunction(()=>document.querySelectorAll('#offers-list .suite-offer').length===3);
  const card=model=>p.locator('#offers-list .suite-offer').filter({hasText:model});
  const samuelCard=()=>card('iPhone 13').filter({hasText:'Samuel'}).first();
  await p.waitForFunction(()=>[...document.querySelectorAll('#offers-list .suite-offer')].some(c=>c.textContent.includes('$499.00')));
  a.match(await samuelCard().textContent(),/Venta web/);a.match(await card('iPhone 14').textContent(),/\$500\.00/,'unedited devices keep cost + $80');
  a.equal((await card('Rojo').textContent()).includes('$499.00'),false,'an edit applies only to its exact catalog variant');
  await samuelCard().locator('summary').first().click();await samuelCard().locator('.web-price-details > summary').click();
  a.match(await samuelCard().locator('.web-price-editor').textContent(),/Ajustes/,'editing requires the saved key');
  await samuelCard().locator('.action-options > summary').click();await samuelCard().locator('button',{hasText:'Usar en venta'}).click();await p.waitForFunction(()=>location.hash.startsWith('#ventas/nueva'));
  a.equal(await p.locator('#sale-form [name=price]').inputValue(),'499.00','the sale is suggested at the web price');a.equal(await p.locator('#sale-form [name=cost]').inputValue(),'350.00','the supplier cost is unchanged');
  // 2. The administration key is verified before it is saved on the phone.
  await p.goto('http://127.0.0.1:8000/#ajustes');await p.locator('#settings-tab-inventory').click();await p.locator('#web-price-settings').waitFor();
  await p.locator('#web-price-key').fill('x'.repeat(40));await p.locator('#web-price-save').click();await p.waitForFunction(()=>document.querySelector('#web-price-status').textContent.includes('no es válida'));
  a.equal(await p.evaluate(()=>catalogKey),'');
  await p.locator('#web-price-key').fill(token);await p.locator('#web-price-save').click();await p.waitForFunction(()=>document.querySelector('#web-price-status').textContent.includes('Clave guardada'));
  a.equal(await p.locator('#web-price-key').inputValue(),'','the key never stays in the page');
  // 3. A price saved in the app is published for the web, keeping the web photos.
  await p.goto('http://127.0.0.1:8000/#ventas/proveedores');await p.waitForFunction(()=>document.querySelectorAll('#offers-list .suite-offer').length===3);
  const open=async locator=>{if(!await locator.evaluate(n=>n.open))await locator.locator('summary').first().click();const more=locator.locator('.web-price-details');if(!await more.evaluate(n=>n.open))await more.locator('summary').click();};
  await open(samuelCard());await samuelCard().locator('.web-price-input').fill('525.50');await samuelCard().locator('button',{hasText:'Guardar precio web'}).click();
  await p.waitForFunction(()=>[...document.querySelectorAll('#offers-list .suite-offer')].some(c=>c.textContent.includes('$525.50')));
  let state=await live();a.equal(state.overrides[key13].priceCents,52550);a.equal(state.overrides[key13].images.length,1,'web photos survive a price edit from the app');
  await open(card('iPhone 14'));await card('iPhone 14').locator('.web-price-input').fill('610');await card('iPhone 14').locator('button',{hasText:'Guardar precio web'}).click();
  const key14=await custom.key(iphone14);await (async()=>{for(let i=0;i<50&&!(await live()).overrides[key14];i++)await new Promise(r=>setTimeout(r,50));})();
  state=await live();a.equal(state.overrides[key14].priceCents,61000,'the app computes the same product and key as the public catalog');
  a.equal(JSON.parse(rows.get('public')).products.length,published.products.length,'inventory is never modified');
  // 4. Concurrent editors: a newer web edit is never overwritten by a stale app.
  await webEdit(iphone14,{priceCents:63000,images:[]});
  await open(card('iPhone 14'));await card('iPhone 14').locator('.web-price-input').fill('600');await card('iPhone 14').locator('button',{hasText:'Guardar precio web'}).click();
  await p.waitForFunction(()=>window.LunivoWebPrices.lastError.includes('más recientes'));
  await p.waitForFunction(()=>[...document.querySelectorAll('.web-price-details[open] .hint.error')].some(n=>n.textContent.includes('más recientes')),null,{timeout:5000});
  a.equal((await live()).overrides[key14].priceCents,63000,'the newer web price is preserved');
  await p.waitForFunction(()=>[...document.querySelectorAll('#offers-list .suite-offer')].some(c=>c.textContent.includes('$630.00')),null,{timeout:5000});
  // 5. Restoring from the app returns both sides to the automatic price.
  await open(card('iPhone 14'));p.once('dialog',d=>d.accept());await card('iPhone 14').locator('button',{hasText:'Usar automático'}).click();
  await p.waitForFunction(()=>[...document.querySelectorAll('#offers-list .suite-offer')].some(c=>c.textContent.includes('iPhone 14')&&c.textContent.includes('$500.00')));
  a.equal((await live()).overrides[key14],undefined,'restore removes the web override');
  await open(samuelCard());p.once('dialog',d=>d.accept());await samuelCard().locator('button',{hasText:'Usar automático'}).click();
  await p.waitForFunction(()=>[...document.querySelectorAll('#offers-list .suite-offer')].some(c=>c.textContent.includes('Samuel')&&c.textContent.includes('$430.00')));
  state=await live();a.equal(state.overrides[key13].priceCents,null);a.equal(state.overrides[key13].images.length,1,'restoring the price keeps web photos');
  // 6. A rotated key is reported and disables editing until saved again.
  env.CATALOG_ADMIN_TOKEN='rotated-admin-key-for-the-catalog-'.repeat(2);
  await open(card('iPhone 14'));await card('iPhone 14').locator('.web-price-input').fill('640');await card('iPhone 14').locator('button',{hasText:'Guardar precio web'}).click();
  await p.waitForFunction(()=>window.LunivoWebPrices.lastError.includes('ya no es válida'));a.equal((await live()).overrides[key14],undefined);
  await p.goto('http://127.0.0.1:8000/#ajustes');await p.locator('#settings-tab-inventory').click();await p.waitForFunction(()=>document.querySelector('#web-price-status').textContent.includes('Guarda la misma clave'));
  // 7. Without the native bridge (browser preview) nothing is shown or requested.
  const plain=await b.newPage({viewport:{width:412,height:915}});plain.on('pageerror',e=>errors.push(e.message));await require('./profile-fixture.cjs').installProfile(plain);await plain.goto('http://127.0.0.1:8000/#ajustes');await plain.locator('#settings-tab-inventory').click();a.equal(await plain.locator('#web-price-settings').isHidden(),true);
  a.deepEqual(errors,[]);
  console.log('PASS web prices: web → app (tarjetas y venta sugerida), app → web con la misma clave del catálogo, fotos conservadas, conflictos sin sobrescribir, restaurar, clave verificada y rotada, sin puente sin cambios.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
