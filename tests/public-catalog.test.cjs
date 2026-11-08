'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildCatalog,modelName}=require('../scripts/build-public-catalog.cjs');
const make=(provider,extra={})=>({id:`feed-${provider}:private`,supplier:provider==='samuel'?'Samuel':'Split',feedProvider:provider,source:'feed',...(provider==='split'?{ownerId:'saul'}:{}),model:'IPHONE 13 PRO 128GB475',capacity:'128GB',color:'Negro',battery:'100%',category:'A',notes:'Private key and IMEI 123456789012345',price:47500,quantity:1,...extra});
const snapshot=()=>({version:1,checkedAt:new Date().toISOString(),providers:{samuel:{total:1,rows:[make('samuel')]},split:{total:1,rows:[make('split')]}}});
test('publishes only customer fields, canonical models and final retail price',()=>{
 const out=buildCatalog(snapshot());
 assert.equal(out.products.length,1);
 const product=out.products[0];
 assert.equal(product.priceCents,55500);assert.equal(product.model,'iPhone 13 Pro');assert.equal(product.capacity,'128 GB');assert.equal(product.quantity,2);
 assert.deepEqual(Object.keys(product).sort(),['id','manufacturer','model','capacity','color','condition','grade','battery','priceCents','available','observations','quantity','cycles','sim','box','ram'].sort());
 assert.doesNotMatch(JSON.stringify(out),/Samuel|Split|saul|private|123456789012345|47500|128GB475/i);
});
test('preserves every unit and price; combines only identical public variants at identical prices',()=>{
 const s=snapshot();s.providers.split.rows[0].price=49000;
 const out=buildCatalog(s);assert.equal(out.products.length,2);
 assert.deepEqual(out.products.map(p=>p.priceCents),[55500,57000]);
 assert.equal(out.products.reduce((n,p)=>n+p.quantity,0),2);
 s.providers.split.rows[0].price=47500;s.providers.split.rows[0].quantity=5;s.providers.split.total=5;
 const combined=buildCatalog(s);assert.equal(combined.products.length,1);assert.equal(combined.products[0].quantity,6);
});
test('requires both valid recent sources and rejects free-form model names',()=>{
 for(const change of [s=>delete s.providers.split,s=>s.providers.samuel.total=99,s=>s.checkedAt='invalid',s=>s.checkedAt='2020-01-01',s=>s.providers.split.rows[0].price=0,s=>s.providers.split.rows[0].model='Contact Samuel for price 475']){
 const s=snapshot();change(s);assert.throws(()=>buildCatalog(s));
 }
 assert.equal(modelName('SAMSUNG S25 NORMAL 128GB 12RAM').model,'Samsung S25');
 assert.equal(modelName('SAMSUNG Z FLIP 6 256GB 12 RAM').model,'Samsung Z Flip 6');
 assert.equal(modelName('IPHONE 16 NORMAL 128GB - 2 CICLOS OPEN BOX').model,'iPhone 16');
});
test('unrecognized declared colors stop publication; private notes are never exported',()=>{
 const s=snapshot();s.providers.samuel.rows[0].color='A color not yet supported';assert.throws(()=>buildCatalog(s),/color/);
 s.providers.samuel.rows[0].color='<script>Samuel key</script>';assert.throws(()=>buildCatalog(s),/color/);
 for(const p of Object.values(s.providers)){p.rows[0].color='Negro';p.rows[0].category='private';p.rows[0].notes='Sold by Javier, cost 475';}
 const out=buildCatalog(s);assert.equal(out.products[0].color,'Negro');assert.equal(out.products[0].condition,'Seminuevo');assert.doesNotMatch(JSON.stringify(out),/script|private|Javier|475/);
});

test('decodes storage shorthand and retains customer-relevant warnings without free text',()=>{
 const s=snapshot();
 s.providers.split.rows[0]={...make('split'),model:'iPhone 13 pro',capacity:'',color:'',notes:'Rosa 256/100% CAJA msj Bateria with private supplier'};
 const p=buildCatalog(s).products.find(p=>p.capacity==='256 GB');
 assert.equal(p.color,'Rosado');assert.equal(p.battery,'100%');assert.deepEqual(p.observations,['Aviso de batería']);
 assert.doesNotMatch(JSON.stringify(p),/private|supplier|CAJA/);
});

test('valid empty inventories remove unavailable units instead of retaining sold stock',()=>{
 const s=snapshot();s.providers.samuel={total:0,rows:[]};
 assert.equal(buildCatalog(s).products.reduce((n,p)=>n+p.quantity,0),1);
 s.providers.split={total:0,rows:[]};assert.deepEqual(buildCatalog(s).products,[]);
});
test('cycles, SIM and box are retained separately, including zero cycles',()=>{
 const s=snapshot();s.providers.samuel.rows[0].notes='128GB 0c CAJA SIM FISICO';s.providers.split.rows[0].notes='128GB 200 CICLOS SIN CAJA';
 const products=buildCatalog(s).products;assert.equal(products.length,2);
 assert(products.some(p=>p.cycles===0&&p.sim==='SIM física'&&p.box===true));
 assert(products.some(p=>p.cycles===200&&p.box===false));
});
test('failed CLI refresh leaves the previous public file intact',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-catalog-test-'));
 try{
  const input=path.join(dir,'bad.json'),output=path.join(dir,'public.json');fs.writeFileSync(input,JSON.stringify({version:1}));fs.writeFileSync(output,'last good catalog');
  const result=spawnSync(process.execPath,[path.resolve('scripts/build-public-catalog.cjs'),input,output]);
  assert.notEqual(result.status,0);assert.equal(fs.readFileSync(output,'utf8'),'last good catalog');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('every specification or condition difference keeps equipment separate',()=>{
 for(const change of [r=>r.color='Blanco',r=>r.capacity='256GB',r=>r.battery='91%',r=>r.category='B+',r=>r.price+=500,r=>r.notes='128GB 5 ciclos',r=>r.notes='SIM FISICO',r=>r.notes='CAJA',r=>r.notes='Msj original camara, pantalla y Truedepth',r=>r.notes='Different unspecified device condition']){
  const s=snapshot();change(s.providers.split.rows[0]);const out=buildCatalog(s);
  assert.equal(out.products.length,2);assert.equal(out.products.reduce((n,p)=>n+p.quantity,0),2);
 }
});
test('component notices separated by intervening words are kept and distinguish the equipment',()=>{
 const s=snapshot();s.providers.samuel.rows[0].notes='Msj original camara y pantalla';s.providers.split.rows[0].notes='Msj original camara, pantalla y Truedepth';
 const products=buildCatalog(s).products;assert.equal(products.length,2);
 assert(products.every(p=>p.observations.includes('Aviso de cámara')&&p.observations.includes('Aviso de pantalla')));
 assert.equal(products.filter(p=>p.observations.includes('Aviso de TrueDepth')).length,1);
});
test('official image manifest has reviewed sources and original local assets match their checksums',()=>{
 const fs=require('node:fs'),{createHash}=require('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8'));
 for(const model of Object.keys(manifest.products)){
  const item=manifest.products[model];assert(item,model);assert.equal(model,item.model+'|'+item.color);assert(item.officialColor);
  for(const url of [item.sourcePage,item.sourceImage]){const host=new URL(url).hostname;assert(new URL(url).protocol==='https:'&&(host.endsWith('.apple.com')||host.endsWith('.samsung.com')));}
  assert.match(item.path,/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/);
  const content=fs.readFileSync('catalogo/'+item.path);assert.equal(createHash('sha256').update(content).digest('hex'),item.sha256);assert(item.width>=200&&item.height>=200);
 }
});

test('seminuevo is the default, preserving new and open box condition and the confirmed natural titanium alias',()=>{
 const s=snapshot();let out=buildCatalog(s);assert(out.products.every(p=>p.condition==='Seminuevo'));
 s.providers.samuel.rows[0].category='Nuevo';s.providers.split.rows[0].category='Open Box';
 out=buildCatalog(s);assert.deepEqual(new Set(out.products.map(p=>p.condition)),new Set(['Nuevo','Open Box']));
 s.providers.samuel.rows[0].color='Titanio';out=buildCatalog(s);assert(out.products.some(p=>p.color==='Titanio natural'));
});
test('color images never fall back to a different finish or a model-wide color lineup',()=>{
 const fs=require('node:fs');const m=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8'));
 assert.equal(m.version,2);
 for(const [key,item]of Object.entries(m.products)){
  assert.equal(key,item.model+'|'+item.color);assert(!item.sourceImage.includes('-colors'));
  assert(!m.unavailable[key]);
 }
 for(const key of Object.keys(m.unavailable))assert(!m.products[key]);
 assert.notEqual(m.products['iPhone 11|Blanco'].path,m.products['iPhone 11|Negro'].path);
 assert.notEqual(m.products['iPhone 16 Pro Max|Negro'].path,m.products['iPhone 16 Pro Max|Titanio natural'].path);
 for(const color of ['Blanco','Amarillo']){const key='Samsung Z Flip 4|'+color;assert.equal(m.products[key].color,color);assert.equal(m.products[key].model,'Samsung Z Flip 4');assert(!m.unavailable[key]);}
 assert.notEqual(m.products['Samsung Z Flip 4|Blanco'].path,m.products['Samsung Z Flip 4|Amarillo'].path);
});

test('explicit supplier colors survive the public projection, including Lila and Glaciar',()=>{
 for(const [raw,expected] of [['Lila','Lila'],['LILAC','Lila'],['Lavanda','Lila'],['Glaciar','Glaciar'],['Glacier','Glaciar'],['Titanium Black','Negro'],['Titanio negro','Negro'],['Titanio natural','Titanio natural']]){
  const s=snapshot();s.providers.samuel.rows[0].color=raw;
  assert(buildCatalog(s).products.some(p=>p.color===expected),raw);
 }
 const s=snapshot();s.providers.split.rows[0]={...make('split'),model:'IPHONE 14 PLUS 128GB',color:'Lila',notes:'128GB · Batería 100% · Seminuevo'};
 const p=buildCatalog(s).products.find(p=>p.model==='iPhone 14 Plus');assert.equal(p.color,'Lila');assert.equal(p.battery,'100%');assert.equal(p.capacity,'128 GB');assert.equal(p.condition,'Seminuevo');
});
test('structured condition takes precedence over stale product titles',()=>{
 const s=snapshot();s.providers.split.rows[0]={...make('split'),model:'IPHONE 17 PRO 256GB - NUEVO',category:'',notes:'256GB · Batería 100% · Open Box'};
 assert.equal(buildCatalog(s).products.find(p=>p.model==='iPhone 17 Pro').condition,'Open Box');
 s.providers.split.rows[0].notes='256GB · Seminuevo';assert.equal(buildCatalog(s).products.find(p=>p.model==='iPhone 17 Pro').condition,'Seminuevo');
 s.providers.split.rows[0].category='Nuevo';assert.equal(buildCatalog(s).products.find(p=>p.model==='iPhone 17 Pro').condition,'Nuevo');
});
test('SIM, RAM and screen condition details are preserved without exporting private notes',()=>{
 const s=snapshot();s.providers.samuel.rows[0].notes='Chip fisico + Esim';
 s.providers.split.rows[0]={...make('split'),model:'SAMSUNG S25 NORMAL 128GB 12RAM',notes:'Burbujitas en pantalla y 2 puntos negros'};
 const out=buildCatalog(s);assert.equal(out.products.find(p=>p.manufacturer==='Apple').sim,'SIM física y eSIM');
 const p=out.products.find(p=>p.manufacturer==='Samsung');assert.equal(p.ram,'12 GB');assert(p.observations.includes('Burbujas en pantalla'));assert(p.observations.includes('Puntos negros en pantalla'));
 assert.doesNotMatch(JSON.stringify(out),/2 puntos|Burbujitas/);
});

test('supplier API to public catalog to image binding keeps the declared Lila color and its actual details',()=>{
 const feeds=require('../feeds-core.js'),fs=require('node:fs'),s=snapshot();s.providers.samuel={rows:[],total:0};
 s.providers.split=feeds.split({moneda:'USD',total:1,actualizado:s.checkedAt,items:[{id:'synthetic-color-regression',origen:'SPLIT',modelo:'IPHONE 14 PLUS 128GB',color:'Lila',detalle:'128GB · Batería 100% · Seminuevo',precio:'300.00'}]});
 const [p]=buildCatalog(s).products;assert.equal(p.model,'iPhone 14 Plus');assert.equal(p.color,'Lila');assert.equal(p.capacity,'128 GB');assert.equal(p.battery,'100%');assert.equal(p.condition,'Seminuevo');assert.equal(p.priceCents,38000);assert.equal(p.quantity,1);
 const images=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8'));assert.equal(images.products[p.model+'|'+p.color].officialColor,'purple');assert(!images.unavailable[p.model+'|'+p.color]);
});

test('photo framing stays within original images and keeps product asset bytes unchanged',()=>{
 const fs=require('node:fs'),m=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8'));
 for(const item of Object.values(m.products))if(item.framing){const f=item.framing;assert([f.x,f.y,f.width,f.height].every(Number.isFinite));assert(f.x>=0&&f.y>=0&&f.width>0&&f.height>0);assert(f.x+f.width<=item.width&&f.y+f.height<=item.height);}
 assert(m.products['Samsung S25 Ultra|Celeste'].framing.width<m.products['Samsung S25 Ultra|Celeste'].width);
});
