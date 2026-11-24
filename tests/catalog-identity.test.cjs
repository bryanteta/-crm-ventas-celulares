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
 assert.throws(()=>catalog.buildCatalog({...s,providers:{...s.providers,split:{rows:rows.filter(r=>r.provider==='split').map(r=>r.row),total:rows.filter(r=>r.provider==='split').reduce((n,r)=>n+r.row.quantity,0)}}}),/Modelo no reconocido/,'the public build keeps refusing unknown models');
});
