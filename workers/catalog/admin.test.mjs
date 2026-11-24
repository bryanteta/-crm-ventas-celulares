import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{CatalogStore} from './worker.mjs';
import custom from '../../catalogo/customization-core.js';
const token='fixture-admin-key-'.repeat(4),source={schemaVersion:1,brand:'Lunivo',currency:'USD',updatedAt:new Date().toISOString(),products:[{id:'1'.repeat(20),manufacturer:'Apple',model:'iPhone 13',capacity:'128 GB',color:'Negro',condition:'Seminuevo',grade:'A',battery:'100%',cycles:null,sim:'Por confirmar',box:null,ram:'',observations:[],sourceInitials:['T'],quantity:3,priceCents:43000,available:true}]};
function setup(secret=token){const rows=new Map([['public',JSON.stringify(source)]]);let fail=false;const sql={exec(query,...args){if(query.startsWith('CREATE'))return {};if(query.startsWith('SELECT'))return {toArray:()=>rows.has(args[0])?[{data:rows.get(args[0])}]:[]};if(fail)throw Error('disk full');rows.set(args[0],args[1]);return {};}};const ctx={storage:{sql},waitUntil:()=>{}};const object=new CatalogStore(ctx,{CATALOG_ADMIN_TOKEN:secret});const env={CATALOG:{idFromName:()=>1,get:()=>object}};return {object,env,rows,setFail:()=>{fail=true;}};}
function request(path='/admin/catalog',method='GET',body,credential=token,origin='https://lunivosv.com'){return new Request('https://fixture'+path,{method,headers:{Origin:origin,...(credential?{Authorization:'Bearer '+credential}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body!==undefined?JSON.stringify(body):undefined});}
const edit={priceCents:49900,images:[{url:'https://cdn.example.com/front.jpg',width:1200,height:1200,label:'Frente'},{url:'https://cdn.example.com/back.jpg',width:1200,height:1200,label:'Reverso'}]};
async function input(){return {key:await custom.key(source.products[0]),productId:source.products[0].id,expectedRevision:0,patch:edit};}
test('admin is closed until configured; missing/wrong credentials and untrusted origins cannot read or write',async()=>{
 for(const secret of ['', 'short']){const {object}=setup(secret);assert.equal((await object.fetch(request())).status,503);}
 const {object,env,rows}=setup();for(const key of ['', 'wrong-key']){assert.equal((await worker.fetch(request('/admin/catalog','GET',undefined,key),env)).status,401);assert.equal((await object.fetch(request('/admin/customizations','PUT',await input(),key))).status,401);}
 assert.equal((await worker.fetch(request('/admin/catalog','GET',undefined,token,'https://attacker.example'),env)).status,403);assert(!rows.has('customizations'));
 const preflight=await worker.fetch(request('/admin/customizations','OPTIONS',undefined,''),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://lunivosv.com');
 assert.equal((await worker.fetch(request('/admin/refresh','POST',{},token),env)).status,404);
});
test('authorized edits persist in SQLite, leave automatic inventory untouched and publish only safe overrides',async()=>{
 const {object,env,rows}=setup();const list=await (await worker.fetch(request(),env)).json();assert.equal(list.products.length,1);assert.equal(list.products[0].customizationKey,(await input()).key);
 const saved=await worker.fetch(request('/admin/customizations','PUT',await input()),env);assert.equal(saved.status,200);const data=await saved.json();assert.equal(data.customizations.revision,1);
 assert.equal(JSON.parse(rows.get('public')).products[0].priceCents,43000);
 const publicData=await (await worker.fetch(new Request('https://fixture/customizations.json'),env)).json();assert.deepEqual(publicData,data.customizations);assert(!JSON.stringify(publicData).includes(token));assert.equal(Object.keys(publicData.overrides).length,1);
 const restarted=new CatalogStore({storage:object.ctx.storage,waitUntil:()=>{}},object.env);assert.deepEqual(await (await restarted.fetch(new Request('https://internal/customizations.json'))).json(),publicData);
});
test('stale editors cannot overwrite edits; restoring deletes only the chosen override',async()=>{
 const {object}=setup(),payload=await input();assert.equal((await object.fetch(request('/admin/customizations','PUT',payload))).status,200);assert.equal((await object.fetch(request('/admin/customizations','PUT',payload))).status,409);
 assert.equal((await object.fetch(request('/admin/customizations','DELETE',{key:payload.key,expectedRevision:0}))).status,409);
 const restored=await object.fetch(request('/admin/customizations','DELETE',{key:payload.key,expectedRevision:1}));assert.equal(restored.status,200);assert.deepEqual((await restored.json()).customizations.overrides,{});
});
test('invalid prices, unsafe URLs, wrong product keys and oversized requests do not alter storage',async()=>{
 const {object,rows}=setup(),payload=await input();for(const patch of [{...edit,priceCents:-1},{...edit,priceCents:1.1},{...edit,images:[{...edit.images[0],url:'javascript:alert(1)'}]},{...edit,images:[{...edit.images[0],url:'https://user:pass@example.com/a.jpg'}]},{...edit,images:[{...edit.images[0],url:'https://127.0.0.1/a.jpg'}]},{...edit,images:[{...edit.images[0],width:1}]}])assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,patch}))).status,400);
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,key:'f'.repeat(32)}))).status,409);
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,productId:'f'.repeat(20)}))).status,409);
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,padding:'x'.repeat(40000)}))).status,413);assert(!rows.has('customizations'));
});
test('storage failure never reports a successful save or discards previous edits',async()=>{
 const s=setup();const payload=await input();await s.object.fetch(request('/admin/customizations','PUT',payload));const before=s.rows.get('customizations');s.setFail();const failed=await s.object.fetch(request('/admin/customizations','DELETE',{key:payload.key,expectedRevision:1}));assert.equal(failed.status,503);assert.equal(s.rows.get('customizations'),before);
});
test('admin awaits stale inventory refresh and preserves every source row with a shared edit key',async()=>{
 const {object}=setup();object.latest=JSON.stringify({...source,updatedAt:'2020-01-01T00:00:00Z'});let refreshed=false;
 object.refresh=async()=>{await new Promise(resolve=>setTimeout(resolve,5));refreshed=true;object.latest=JSON.stringify({...source,updatedAt:new Date().toISOString(),products:[source.products[0],{...source.products[0],id:'2'.repeat(20),priceCents:44000}]});return true;};
 const data=await (await object.fetch(request())).json();assert(refreshed);assert.equal(data.cached,false);assert.equal(data.products.length,2);assert.equal(data.products[0].customizationKey,data.products[1].customizationKey);assert.notEqual(data.products[0].id,data.products[1].id);
});
test('admin retains the last complete inventory when providers cannot refresh',async()=>{
 const {object}=setup();object.latest=JSON.stringify({...source,updatedAt:'2020-01-01T00:00:00Z'});object.refresh=async()=>false;
 const response=await object.fetch(request());assert.equal(response.status,200);const data=await response.json();assert.equal(data.cached,true);assert.equal(data.products.length,1);
});
test('different keys can be edited concurrently; same-key conflicts remain protected and no-op deletes do not advance revision',async()=>{
 const {object}=setup(),first=await input(),other={...source.products[0],id:'2'.repeat(20),color:'Blanco'};
 object.latest=JSON.stringify({...source,products:[source.products[0],other]});
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...first,expectedEdit:null}))).status,200);
 const second={...first,key:await custom.key(other),productId:other.id,expectedEdit:null};
 assert.equal((await object.fetch(request('/admin/customizations','PUT',second))).status,200);
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...first,expectedEdit:null}))).status,409);
 const missing=await (await object.fetch(request('/admin/customizations','DELETE',{key:'f'.repeat(32),expectedRevision:0}))).json();assert.equal(missing.customizations.revision,2);assert.equal(Object.keys(missing.customizations.overrides).length,2);
});
test('typed keys and product IDs are required; an unavailable inventory reports 503 rather than a changed device',async()=>{
 const {object}=setup(),payload=await input();for(const change of [{key:[payload.key]},{productId:[payload.productId]},{expectedEdit:[]}])assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,...change}))).status,400);
 object.latest=null;object.refresh=async()=>false;assert.equal((await object.fetch(request('/admin/customizations','PUT',payload))).status,503);
});
test('saved context survives provider/specification changes; orphaned edits can be explicitly reassigned or removed',async()=>{
 const {object,rows}=setup(),payload=await input();await object.fetch(request('/admin/customizations','PUT',payload));
 const changed={...source.products[0],id:'2'.repeat(20),battery:'95%',sourceInitials:['T','S'],priceCents:55000};object.latest=JSON.stringify({...source,products:[changed]});
 const list=await (await object.fetch(request())).json();assert.notEqual(list.products[0].customizationKey,payload.key);assert.equal(list.customizations.overrides[payload.key].priceCents,49900);assert.equal(list.adminMetadata[payload.key].automaticPriceCentsAtEdit,43000);assert.deepEqual(list.adminMetadata[payload.key].product.sourceInitials,['T']);
 const moved=await object.fetch(request('/admin/customizations','PUT',{key:list.products[0].customizationKey,productId:changed.id,fromKey:payload.key,expectedRevision:1,patch:edit}));assert.equal(moved.status,200);const next=await moved.json();assert(!next.customizations.overrides[payload.key]);assert.equal(next.adminMetadata[list.products[0].customizationKey].automaticPriceCentsAtEdit,55000);
 const persisted=JSON.parse(rows.get('customizations'));assert(persisted.adminMetadata);
 const publicData=await (await object.fetch(new Request('https://fixture/customizations.json'))).json();assert(!('adminMetadata' in publicData));
 const deleted=await object.fetch(request('/admin/customizations','DELETE',{key:list.products[0].customizationKey,expectedRevision:2}));assert.equal(deleted.status,200);assert.deepEqual((await deleted.json()).adminMetadata,{});
});
test('the 1000-edit limit is explicit and removing an orphan restores capacity without deleting other edits',async()=>{
 const {object,rows}=setup(),payload=await input(),overrides={};for(let i=1;i<=1000;i++)overrides[i.toString(16).padStart(32,'0')]={priceCents:49900,images:[]};
 rows.set('customizations',JSON.stringify({version:1,revision:1,updatedAt:new Date().toISOString(),overrides}));const before=rows.get('customizations');
 const full=await object.fetch(request('/admin/customizations','PUT',{...payload,expectedRevision:1}));assert.equal(full.status,413);assert.match((await full.json()).error,/1000/);assert.equal(rows.get('customizations'),before);
 const remove=await object.fetch(request('/admin/customizations','DELETE',{key:'1'.padStart(32,'0'),expectedRevision:1}));assert.equal(remove.status,200);
 assert.equal((await object.fetch(request('/admin/customizations','PUT',{...payload,expectedRevision:2}))).status,200);assert.equal(Object.keys(JSON.parse(rows.get('customizations')).overrides).length,1000);
});
test('public snapshots are briefly cacheable while authenticated responses remain private',async()=>{
 const {object}=setup();assert.equal((await object.fetch(request())).headers.get('Cache-Control'),'no-store');const r=await object.fetch(new Request('https://fixture/customizations.json'));assert.equal(r.headers.get('Cache-Control'),'public, max-age=30');
});
test('saving a shared-key edit records the entire automatic price range and compact context',async()=>{
 const {object}=setup(),payload=await input();object.latest=JSON.stringify({...source,products:[source.products[0],{...source.products[0],id:'2'.repeat(20),priceCents:63000}]});const saved=await (await object.fetch(request('/admin/customizations','PUT',payload))).json(),metadata=saved.adminMetadata[payload.key];assert.deepEqual(metadata.automaticPriceRangeAtEdit,{min:43000,max:63000});assert.equal(metadata.automaticPriceCentsAtEdit,63000);assert(!('quantity' in metadata.product));assert(!('id' in metadata.product));assert(!('priceCents' in metadata.product));assert.equal(await custom.key(metadata.product),payload.key);
});
test('backup export and import require authentication and restore compact metadata after a storage reset without touching inventory',async()=>{
 const {object,env,rows}=setup(),payload=await input();for(const path of ['/admin/backup','/admin/import'])assert.equal((await worker.fetch(request(path,path.endsWith('import')?'PUT':'GET',path.endsWith('import')?{}:undefined,''),env)).status,401);
 await object.fetch(request('/admin/customizations','PUT',payload));const backup=await (await worker.fetch(request('/admin/backup'),env)).json();assert.equal(backup.format,'lunivo-catalog-backup');assert(backup.adminMetadata[payload.key]);assert(!JSON.stringify(backup).includes(token));const inventory=rows.get('public');rows.delete('customizations');
 const restored=await worker.fetch(request('/admin/import','PUT',{expectedRevision:0,snapshot:backup}),env);assert.equal(restored.status,200);const data=await restored.json();assert.deepEqual(data.customizations.overrides,backup.customizations.overrides);assert.deepEqual(data.adminMetadata,backup.adminMetadata);assert.equal(rows.get('public'),inventory);assert.equal(data.customizations.revision,1);
 const publicData=await (await object.fetch(new Request('https://fixture/customizations.json'))).json();assert(!('adminMetadata' in publicData));assert.equal(publicData.overrides[payload.key].priceCents,edit.priceCents);
 assert.equal((await object.fetch(request('/admin/import','PUT',{expectedRevision:0,snapshot:backup}))).status,409);
});
test('public JSON imports merge without deleting unrelated edits; invalid backup metadata and excessive size cannot write',async()=>{
 const {object,rows}=setup(),payload=await input();await object.fetch(request('/admin/customizations','PUT',payload));const other='f'.repeat(32),snapshot={...custom.empty(),overrides:{[other]:{priceCents:55500,images:[]}}};assert.equal((await object.fetch(request('/admin/import','PUT',{expectedRevision:1,snapshot}))).status,200);const before=rows.get('customizations');assert.equal(Object.keys(JSON.parse(before).overrides).length,2);
 const backup=await (await object.fetch(request('/admin/backup'))).json();const bad={...backup,adminMetadata:{[payload.key]:{...backup.adminMetadata[payload.key],product:{...source.products[0],color:'wrong'}}}};assert.equal((await object.fetch(request('/admin/import','PUT',{expectedRevision:2,snapshot:bad}))).status,400);assert.equal(rows.get('customizations'),before);
 const unsafe={...snapshot,overrides:{[other]:{priceCents:55500,images:[{url:'javascript:alert(1)',width:600,height:600}]}}};assert.equal((await object.fetch(request('/admin/import','PUT',{expectedRevision:2,snapshot:unsafe}))).status,400);assert.equal(rows.get('customizations'),before);
 assert.equal((await object.fetch(request('/admin/import','PUT',{expectedRevision:2,snapshot,padding:'x'.repeat(4*1024*1024+16384)}))).status,413);assert.equal(rows.get('customizations'),before);
 const formatted=JSON.stringify({expectedRevision:2,snapshot}).replace('{','{'+ ' '.repeat(1024*1024));const r=request('/admin/import','PUT',{});assert.equal((await object.fetch(new Request(r,{body:formatted}))).status,200);
});
test('reassignments protect both keys while permitting unrelated concurrent edits',async()=>{
 const {object,rows}=setup(),payload=await input();await object.fetch(request('/admin/customizations','PUT',payload));const target={...source.products[0],id:'2'.repeat(20),color:'Blanco'},other={...source.products[0],id:'3'.repeat(20),color:'Rojo'};object.latest=JSON.stringify({...source,products:[target,other]});const targetKey=await custom.key(target),otherKey=await custom.key(other);await object.fetch(request('/admin/customizations','PUT',{key:otherKey,productId:other.id,expectedRevision:1,patch:edit}));
 const transfer={key:targetKey,productId:target.id,fromKey:payload.key,expectedRevision:1,expectedEdit:null,expectedFromEdit:edit,patch:edit};assert.equal((await object.fetch(request('/admin/customizations','PUT',transfer))).status,200);const before=rows.get('customizations');assert.equal(Object.keys(JSON.parse(before).overrides).length,2);assert.equal((await object.fetch(request('/admin/customizations','PUT',transfer))).status,409);assert.equal(rows.get('customizations'),before);
});
test('failed logins are bounded per connecting IP and expire; backups and imports share the protection',async()=>{
 const {object}=setup(),attempt=(ip,path='/admin/backup',credential='wrong')=>{const r=request(path,'GET',undefined,credential);r.headers.set('CF-Connecting-IP',ip);return r;};for(let i=0;i<10;i++)assert.equal((await object.fetch(attempt('1.1.1.1'))).status,401);const limited=await object.fetch(attempt('1.1.1.1'));assert.equal(limited.status,429);assert(Number(limited.headers.get('Retry-After'))>0);assert.equal((await object.fetch(attempt('2.2.2.2','/admin/backup',token))).status,200);object.failedLogins.get('1.1.1.1').until=Date.now()-1;assert.equal((await object.fetch(attempt('1.1.1.1','/admin/backup',token))).status,200);
});
