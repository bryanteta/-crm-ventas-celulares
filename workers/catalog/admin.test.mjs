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
