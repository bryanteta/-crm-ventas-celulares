// Rollback safety: after sales move to IndexedDB, an older version (or old tab) that only knows the
// localStorage blob cannot see them. If it writes that blob again, the newer version must MERGE it
// instead of replacing the migrated sales, and must never reuse a receipt correlative.
const {chromium}=require('playwright'),a=require('node:assert/strict');
const KEY='lunivo-suite-preview-v1:local',base='http://127.0.0.1:8000/';
const sale=(id,client,extra={})=>({id,client,model:'iPhone 13',date:'2026-10-24',quantity:1,price:43000,cost:35000,expenses:0,sellerId:'test-user',sellerName:'Usuario de pruebas',status:'Confirmada',total:43000,profit:8000,commission:0,net:8000,...extra});
const clients=page=>page.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)).sales.map(s=>s.client),KEY);
const stored=page=>page.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)),KEY);
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:412,height:915}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await require('./profile-fixture.cjs').installProfile(p);await p.addInitScript(()=>sessionStorage.setItem('lunivo-intro-v1','seen'));
 await p.goto(base+'#ventas');
 // 1) Three sales in the old format are migrated and the blob is removed.
 await p.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify({sales:[sale('a','Ana'),sale('b','Beto'),sale('c','Carla')],offers:[],inventory:[{id:'stock',model:'Galaxy S25',cost:30000,quantity:3,ownerId:'lunivo'}],receiptCounters:{'2026-11':7}})]);
 await p.reload();a.deepEqual(await clients(p),['Ana','Beto','Carla']);a.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null);
 // 2) An older version (which sees nothing) writes its own blob with one new sale, an edit and lower counters.
 const legacy=JSON.stringify({sales:[sale('d','Dina'),sale('b','Beto editado')],offers:[],inventory:[],receiptCounters:{'2026-11':1,'2026-12':1}});
 await p.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,legacy]);await p.reload();
 let data=await stored(p);
 a.deepEqual(data.sales.map(s=>s.client),['Dina','Beto editado','Ana','Carla'],'migrated sales survive; the legacy copy adds and wins on the same id');
 a.deepEqual(data.receiptCounters,{'2026-11':7,'2026-12':1},'receipt correlatives keep the highest number');
 a.deepEqual(data.inventory.map(i=>i.id),['stock'],'inventory is merged, not emptied');
 await p.waitForFunction(k=>localStorage.getItem(k)===null,KEY);
 // 3) Same while the app is already open (an old tab writes the blob): merged on the next read.
 await p.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify({sales:[sale('e','Elena')],offers:[],inventory:[]})]);
 await p.evaluate(()=>window.LunivoSuite.render());await p.evaluate(k=>LunivoSuiteStore.saved(k),KEY);
 a.deepEqual((await stored(p)).sales.map(s=>s.client),['Elena','Dina','Beto editado','Ana','Carla']);
 await p.reload();a.deepEqual(await clients(p),['Elena','Dina','Beto editado','Ana','Carla'],'the merge was saved');
 a.deepEqual(errors,[]);
 console.log('PASS rollback: una versión anterior que reescribe el formato viejo se combina por venta (sin perder las migradas), conserva el mayor correlativo e inventario, al abrir y con la app abierta.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
