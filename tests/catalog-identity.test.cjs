'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const feeds=require('../feeds-core.js'),catalog=require('../scripts/catalog-core.cjs'),identity=require('../catalog-identity.js'),custom=require('../catalogo/customization-core.js');
const samuel={c:JSON.stringify({columnas:['Modelo','Color','Capacidad','Batería','Categoría','Precio Venta','Observaciones'],filas:[['iPhone 13','Negro','128GB','100%','A+','$350.00',''],['iPhone 13','Negro','128GB','100%','A+','$350.00',''],['iphone 14 pro max','Morado Oscuro','256 GB','88%','B','$620','msj bateria, sin caja, 450 ciclos esim'],['Apple Watch S8','Negro','','','A','$100','']],ahora:Date.now(),leido:Date.now()})};
const split={actualizado:new Date().toISOString(),moneda:'USD',total:4,items:[{id:'s1',origen:'SPLIT',modelo:'IPHONE 13 NORMAL 128GB',detalle:'128GB · Seminuevo',color:'Rojo',precio:345},{id:'j1',origen:'JAVIER',modelo:'iPhone 14 · 128GB',detalle:'128GB',color:'Azul',precio:420},{id:'s2',origen:'SPLIT',modelo:'Samsung Galaxy S23 Ultra',detalle:'256GB 8GB RAM',color:'Phantom Black',precio:510},{id:'s3',origen:'SPLIT',modelo:'iPhone 14 · 128GB',detalle:'128GB',color:'Azul',precio:420}]};
const snapshot=()=>({version:1,checkedAt:new Date().toISOString(),providers:{samuel:feeds.samuelApi(samuel),split:feeds.split(split)}});
const entries=s=>['samuel','split'].flatMap(provider=>s.providers[provider].rows.map(row=>({provider,row})));
test('the app groups provider rows into the same published products, IDs and customization keys',async()=>{
 const s=snapshot(),published=catalog.buildCatalog(s),grouped=identity.group(entries(s));
 const products=[...new Set(grouped.rows.values())];assert.equal(products.length,published.products.length);
 for(const product of products){
  const id=createHash('sha256').update(product.mergeKey).digest('hex').slice(0,20),match=published.products.find(p=>p.id===id);
  assert(match,'every app product exists in the public catalog');assert.deepEqual(product.sourceInitials,match.sourceInitials);assert.equal(product.priceCents,match.priceCents);assert.equal(product.quantity,match.quantity);
  assert.equal(await custom.key({...product.specs,sourceInitials:product.sourceInitials}),await custom.key(match),'same key the Worker validates on save');
 }
 const shared=products.find(p=>p.sourceInitials.length>1);assert(shared,'units from several providers merge like the catalog');assert.deepEqual(shared.sourceInitials,['S','J']);
});
test('wearables are excluded and unpublishable rows are skipped by the app instead of failing every price',()=>{
 const s=snapshot(),rows=entries(s);rows.push({provider:'split',row:{...rows[rows.length-1].row,id:'feed-split:unknown',model:'Nokia 3310'}});
 const grouped=identity.group(rows);assert.equal(grouped.skipped.length,1);assert.equal(grouped.rows.has('feed-split:unknown'),false);
 assert.equal([...grouped.rows.values()].some(p=>/Watch/.test(p.specs.model)),false);
 const skipped=[],published=catalog.buildCatalog({...s,providers:{...s.providers,split:{rows:rows.filter(r=>r.provider==='split').map(r=>r.row),total:rows.filter(r=>r.provider==='split').reduce((n,r)=>n+r.row.quantity,0)}}},Date.now(),null,skipped);
 assert.deepEqual(skipped,[{provider:'split',model:'Nokia 3310'}],'the public build reports unknown models instead of freezing');
 assert.equal(published.products.length,catalog.buildCatalog(s).products.length,'every other unit is still published');
});
test('recent and edition models get their own names instead of merging with another model',()=>{
 const expected={'iPhone 16e':'iPhone 16e','iPhone 17e 256GB':'iPhone 17e','IPHONE 16E':'iPhone 16e','iPhone Air':'iPhone 17 Air','Apple iPhone Air 256GB':'iPhone 17 Air','iPhone 17 Air':'iPhone 17 Air','iPhone XS Max':'iPhone XS Max','iPhone XS':'iPhone XS','iPhone XR':'iPhone XR','iPhone 16 Pro Max':'iPhone 16 Pro Max','iPhone 16':'iPhone 16','Samsung Galaxy S25 Edge':'Samsung S25 Edge','Samsung Galaxy S25':'Samsung S25','Samsung Galaxy S23+':'Samsung S23 Plus','Samsung S23 Plus':'Samsung S23 Plus','Galaxy S24 FE':'Samsung S24 FE','Galaxy Z Fold6':'Samsung Z Fold 6'};
 for(const [raw,model] of Object.entries(expected))assert.equal(identity.modelName(raw).model,model,raw);
 assert.throws(()=>identity.modelName('iPhone 11 Max'),e=>e.code==='unknown-model');
});
test('tablets, other brands and accessories are left out without failing the build',()=>{
 const base=snapshot().providers.split.rows[0];
 for(const model of ['iPad Air','iPad Pro 11 256GB','Apple iPad 10','Samsung Galaxy Tab S9','Galaxy Tab A9','Galaxy Buds 3','AirPods Pro 2','Apple Watch S8','Galaxy Watch 7','Google Pixel 9','Pixel 8 Pro','Xiaomi Redmi Note 13'])assert.equal(identity.describe('split',{...base,model}),null,model);
 const s=snapshot(),rows=s.providers.split.rows,extra=['iPhone 16e','iPhone 17e','iPhone Air','iPhone XS Max','Samsung Galaxy S25 Edge','Samsung Galaxy S23+','iPad Air','Samsung Galaxy Tab S9','Google Pixel 9','Motorola Edge 50'].map((model,i)=>({...base,id:'feed-split:x'+i,model}));
 const split={rows:[...rows,...extra],total:[...rows,...extra].reduce((n,r)=>n+r.quantity,0)},skipped=[];
 const published=catalog.buildCatalog({...s,providers:{...s.providers,split}},Date.now(),null,skipped);
 assert.deepEqual(skipped,[]);const models=new Set(published.products.map(p=>p.model));
 for(const model of ['iPhone 16e','iPhone 17e','iPhone 17 Air','iPhone XS Max','Samsung S25 Edge','Samsung S23 Plus'])assert(models.has(model),model);
 for(const model of models)assert.match(model,/^(?:iPhone|Samsung) /);
 assert.equal(models.has('iPhone Air'),false,'iPhone Air and iPhone 17 Air are one model');
});
test('unknown phone rows are skipped with a warning while other refusals still keep the previous catalog',()=>{
 const s=snapshot(),base=s.providers.split.rows[0],skipped=[];
 const split=rows=>({rows,total:rows.reduce((n,r)=>n+r.quantity,0)});
 const published=catalog.buildCatalog({...s,providers:{...s.providers,split:split([...s.providers.split.rows,{...base,id:'feed-split:new',model:'Nothing Phone (3) $499.00'}])}},Date.now(),null,skipped);
 assert.deepEqual(skipped,[{provider:'split',model:'Nothing Phone 3'}],'the report never carries prices or symbols');assert(published.products.length>0);
 assert.throws(()=>catalog.buildCatalog({...s,providers:{...s.providers,split:split([...s.providers.split.rows,{...base,id:'feed-split:color',color:'Fucsia neón'}])}}),/color/,'an unknown color still refuses to publish');
});
