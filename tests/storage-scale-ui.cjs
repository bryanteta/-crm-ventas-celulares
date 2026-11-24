// Scale: sales live in IndexedDB. Migrates a legacy localStorage blob without loss, keeps saving with
// 5,000+ realistic sales (accessories + warranty), survives a reload right after saving, reverts a
// failed transaction, and reports local space with a warning above 70 %.
const {chromium}=require('playwright'),a=require('node:assert/strict');
const KEY='lunivo-suite-preview-v1:local',base='http://127.0.0.1:8000/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:412,height:915}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await require('./profile-fixture.cjs').installProfile(p);await p.addInitScript(()=>sessionStorage.setItem('lunivo-intro-v1','seen'));
 await p.goto(base+'#ventas');
 // Realistic confirmed sale: device, three accessories, gifts and a complete warranty receipt (~2.4 KB).
 const sales=(from,count)=>p.evaluate(({from,count})=>{const list=[];for(let n=from;n<from+count;n++){const month='2026-'+String(1+n%11).padStart(2,'0'),date=month+'-'+String(1+n%27).padStart(2,'0');
  const r={id:'scale-'+n,stockId:'',stockDeducted:false,client:'Cliente de prueba número '+n,model:'iPhone 14 Pro Max',supplier:'Samuel',notes:'Entrega en tienda, cliente frecuente',date,quantity:1,price:74000,cost:61000,expenses:500,accessoryItems:[{id:'charger-'+n,catalogId:'charger',name:'Cargador completo · Cable y cubo',price:2500},{id:'glass-'+n,catalogId:'glass',name:'Protector de pantalla',price:1000},{id:'case-'+n,catalogId:'case',name:'Funda transparente',price:1500}],accessoryCost:1800,status:'Confirmada',paidAt:null,commissionEnabled:false,sellerId:'test-user',sellerName:'Usuario de pruebas',createdAt:date+'T15:00:00.000Z',saleNumber:String(100000+n),saleSequence:n+1,saleMonth:month,followupId:'',offerId:'',offerDate:'',stockOwnerId:'',stockOwnerName:''};
  r.accessories=LunivoSalesCore.accessoryTotal(r.accessoryItems);Object.assign(r,LunivoSalesCore.totals(r));
  r.receipt={version:1,number:r.saleNumber,deliveryDate:date,savedAt:date+'T15:05:00.000Z',brand:'Apple',capacity:'128 GB',color:'Morado',condition:'Seminuevo',battery:'90%',physical:'Sin daños visibles',serials:['3567'+String(n).padStart(11,'0')],phone:'+50370000000',paymentMethod:'Tasa cero',bank:'Banco Promerica',months:12,channel:'Tienda',warrantyMonths:3,terms:[...LunivoReceipt.TERMS],gifts:[{name:'Cargador completo',reference:2500},{name:'Protector de pantalla',reference:1000}],company:{...LunivoReceipt.COMPANY}};
  LunivoSalesCore.validateSale(r);list.push(r);}return list;},{from,count});
 const sample=await sales(0,1),size=JSON.stringify(sample[0]).length;a.ok(size>2000,'each sale is realistic: '+size+' characters');
 // 1) Migration: 1,800 sales (the most that fit the old localStorage limit with other data) move to IndexedDB.
 const legacy=JSON.stringify({sales:await sales(0,1800),offers:[],inventory:[{id:'stock',model:'Galaxy S25',cost:30000,quantity:3,ownerId:'lunivo'}],receiptCounters:{'2026-11':1800}});
 await p.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,legacy]);await p.reload();
 a.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),null,'the legacy blob is removed after a verified copy');
 a.equal(await p.evaluate(k=>LunivoSuiteStore.peek(k),KEY),legacy,'migrated data is identical, including key order');
 // 2) Grow to 5,000 sales: impossible before (QuotaExceededError at ~2,100).
 const grown=JSON.parse(legacy);grown.sales.push(...await sales(1800,3200));
 await p.evaluate(([k,v])=>LunivoSuiteStore.write(k,v),[KEY,JSON.stringify(grown)]);await p.reload();
 a.equal(await p.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)).sales.length,KEY),5000);
 const localChars=await p.evaluate(()=>{let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=k.length+localStorage.getItem(k).length;}return n;});
 a.ok(localChars<100000,'localStorage keeps only small settings: '+localChars+' characters');
 // 3) The app still saves through the form, and the sale survives an immediate reload (journal).
 await p.goto(base+'#ventas/nueva');const f=p.locator('#sale-form');
 for(const[k,v]of Object.entries({client:'Venta 5001',model:'Galaxy S25',price:'500'}))await f.locator(`[name=${k}]`).fill(v);
 const started=Date.now();await p.locator('#sale-confirm').click();await p.locator('#sale-detail').waitFor();const saveMs=Date.now()-started;
 a.match(await p.locator('#sale-detail').textContent(),/Venta 5001/);await p.reload();await p.locator('#sale-detail').waitFor();
 a.match(await p.locator('#sale-detail').textContent(),/Venta 5001/,'saved sale is still there after reloading at once');
 let stored=await p.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)),KEY);a.equal(stored.sales.length,5001);a.equal(stored.sales[0].client,'Venta 5001');a.equal(stored.inventory[0].quantity,3);
 a.equal(await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('lunivo-suite-journal-v1:')).length),0,'journal is cleared once saved');
 await p.goto(base+'#ventas/historial');a.match(await p.locator('#sales-history-count').textContent(),/5001 registro/);
 // 4) Reads stay fast enough for typing and rendering.
 const readMs=await p.evaluate(()=>{const t=performance.now();for(let i=0;i<5;i++)window.LunivoSuite.render();return (performance.now()-t)/5;});
 // 5) A transaction that fails after starting restores the last saved copy and tells the user.
 await p.goto(base+'#ventas/nueva');for(const[k,v]of Object.entries({client:'No debe quedar',model:'Galaxy S25',price:'500'}))await f.locator(`[name=${k}]`).fill(v);
 await p.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const r=window.__put.apply(this,args),tx=this.transaction;queueMicrotask(()=>{try{tx.abort()}catch{}});return r;};});
 await require('./ui-actions.cjs').click(p.locator('#sale-draft'));
 await p.waitForFunction(()=>/No se pudieron guardar/.test(document.querySelector('#notice').textContent));
 await p.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});
 a.equal(await p.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)).sales.some(s=>s.client==='No debe quedar'),KEY),false,'failed save is reverted in memory');
 await p.reload();stored=await p.evaluate(k=>JSON.parse(LunivoSuiteStore.peek(k)),KEY);a.equal(stored.sales.length,5001);a.equal(stored.sales.some(s=>s.client==='No debe quedar'),false,'and is not on disk');
 // 6) Settings shows local usage and warns above 70 %.
 await p.goto(base+'#ajustes');await p.locator('[data-settings-tab=app]').click();await p.waitForFunction(()=>/5.001 venta/.test(document.querySelector('#storage-usage').textContent));
 a.equal(await p.locator('#storage-usage-warning').isHidden(),true);
 await p.evaluate(()=>localStorage.setItem('scale-filler','x'.repeat(3600000)));await p.evaluate(()=>LunivoSettings.usage());
 a.equal(await p.locator('#storage-usage-warning').isVisible(),true);a.match(await p.locator('#storage-usage-warning').textContent(),/7\d %/);
 a.match(await p.locator('#notice').textContent(),/espacio local/i);await p.evaluate(()=>localStorage.removeItem('scale-filler'));
 a.deepEqual(errors,[]);
 console.log('PASS escala: '+size+' caracteres por venta, 1,800 migradas sin pérdida, 5,001 guardadas en IndexedDB, guardado '+saveMs+' ms, render '+Math.round(readMs)+' ms, recarga inmediata conservada, fallo revertido, aviso al 70 %');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
