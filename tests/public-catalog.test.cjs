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
 assert.deepEqual(Object.keys(product).sort(),['id','manufacturer','model','capacity','color','condition','grade','battery','priceCents','available','observations','quantity','cycles','sim','box'].sort());
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
test('unknown colors and notes cannot leak arbitrary data',()=>{
 const s=snapshot();for(const p of Object.values(s.providers)){p.rows[0].color='<script>Samuel key</script>';p.rows[0].category='private';p.rows[0].notes='Sold by Javier, cost 475';}
 const out=buildCatalog(s);assert.equal(out.products[0].color,'Color por confirmar');assert.equal(out.products[0].condition,'Estado por confirmar');assert.doesNotMatch(JSON.stringify(out),/script|private|Javier|475/);
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
