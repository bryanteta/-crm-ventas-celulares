import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
let calls=0;const stamp=Date.now(),state=mkdtempSync(join(tmpdir(),'lunivo-worker-test-'));
const config={name:'lunivo-runtime-test',modules:true,resourcePersistencePath:state,script:readFileSync('/tmp/lunivo-worker-dist/worker.js','utf8'),compatibilityDate:'2026-11-01',compatibilityFlags:['nodejs_compat'],bindings:{SPLIT_INVENTORY_TOKEN:'fixture-secret',CATALOG_ADMIN_TOKEN:'fixture-admin-secret-'.repeat(4)},durableObjects:{CATALOG:{className:'CatalogStore',useSQLite:true}},outboundService:async request=>{calls++;if(request.url.includes('script.google.com')){assert(!request.headers.has('X-API-Key'));return Response.json({columnas:['Modelo','Color','Capacidad','Batería','Categoría','Precio Venta','Observaciones'],filas:[['iPhone 13','Negro','128 GB','100%','A','350','private IMEI']],proximos:[],ahora:stamp,leido:stamp})}assert.equal(new URL(request.url).hostname,'split-crm.splitelsalvador.workers.dev');assert.equal(request.headers.get('X-API-Key'),'fixture-secret');return Response.json({actualizado:new Date(stamp).toISOString(),moneda:'USD',total:1,items:[{id:1,origen:'SPLIT',modelo:'iPhone 14',detalle:'128 GB',color:'Lila',precio:400}]})}};
let mf=new Miniflare(convertV4MiniflareOptions(config));
try{
 const response=await mf.dispatchFetch('https://fixture/inventory.json');assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.products.map(p=>p.priceCents),[43000,48000]);assert.equal(calls,2);assert(!JSON.stringify(data).includes('fixture-secret'));assert(!JSON.stringify(data).includes('private IMEI'));
 const adminHeaders={Authorization:'Bearer '+'fixture-admin-secret-'.repeat(4),Origin:'https://lunivosv.com','Content-Type':'application/json'};
 assert.equal((await mf.dispatchFetch('https://fixture/admin/catalog')).status,401);
 const admin=await (await mf.dispatchFetch('https://fixture/admin/catalog',{headers:adminHeaders})).json();
 const key=admin.products[0].customizationKey;
 const saved=await mf.dispatchFetch('https://fixture/admin/customizations',{method:'PUT',headers:adminHeaders,body:JSON.stringify({key,productId:admin.products[0].id,expectedRevision:0,patch:{priceCents:49900,images:[]}})});assert.equal(saved.status,200);
 const customizations=await (await mf.dispatchFetch('https://fixture/customizations.json')).json();assert.equal(customizations.overrides[key].priceCents,49900);assert(!JSON.stringify(customizations).includes('fixture-admin-secret'));
 await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions({...config,bindings:{SPLIT_INVENTORY_TOKEN:''}}));
 assert.deepEqual(await (await mf.dispatchFetch('https://fixture/inventory.json')).json(),data,'snapshot survives restart without contacting providers');assert.equal(calls,2);
 assert.deepEqual(await (await mf.dispatchFetch('https://fixture/customizations.json')).json(),customizations,'manual edits survive restart independently of provider inventory');
 assert.equal((await mf.dispatchFetch('https://fixture/refresh',{method:'POST'})).status,404);
 console.log('PASS real Cloudflare runtime: SQLite survives restart, +80 retail, privacy, credential boundary and shared cooldown.');
}finally{await mf.dispose();rmSync(state,{recursive:true,force:true});}
