'use strict';
const {chromium,webkit}=require('playwright'),a=require('node:assert/strict');
const source=require('../catalogo/inventory.json');
const base={...source.products[0],capacity:'128 GB',condition:'Seminuevo',grade:'A',battery:'100%',priceCents:40000,quantity:1,observations:[],ram:'',sim:'Por confirmar',box:null,cycles:null,available:true};
const rows=[
 ['Apple','iPhone 11 Pro Max','Verde',50000,2],['Apple','iPhone 11','Blanco',30000,1],['Apple','iPhone 11','Negro',30000,3],
 ['Apple','iPhone 13 Pro','Negro',60000,1,'256 GB'],['Apple','iPhone 13 Mini','Negro',45000,1],['Apple','iPhone 12','Negro',39000,1],
 ['Samsung','Samsung S25 Ultra','Negro',90000,1],['Samsung','Samsung S25 FE','Negro',49000,1],['Samsung','Samsung S26 Plus','Negro',98000,1],
 ['Samsung','Samsung Z Flip 4','Blanco',31000,1],['Samsung','Samsung Z Flip 6','Negro',59000,1],['Samsung','Samsung Z Fold 5','Celeste',71000,1]
];
const products=rows.map(([manufacturer,model,color,priceCents,quantity,capacity],i)=>({...base,id:(i+1).toString(16).padStart(20,'0'),manufacturer,model,color,priceCents,quantity,capacity:capacity||base.capacity}));
async function run(type){
 const browser=await type.launch(type===chromium?{executablePath:process.env.CI?undefined:'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  let inventory={...source,updatedAt:new Date().toISOString(),products};
  await p.clock.install();await p.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:''}}));await p.route('**/inventory.json',r=>r.fulfill({json:inventory}));
  await p.goto('http://127.0.0.1:8000/catalogo/');await p.locator('.card').first().waitFor();
  const titles=()=>p.locator('.series-heading h3').allTextContents();
  const expected=['iPhone 11','iPhone 12','iPhone 13','Galaxy S25','Galaxy S26','Galaxy Z Flip','Galaxy Z Fold'];a.deepEqual(await titles(),expected);
  const ids=await p.locator('#products .color-swatch').evaluateAll(bs=>bs.map(b=>b.dataset.variantId));a.deepEqual(ids.sort(),products.map(p=>p.id).sort(),'grouping preserves every source variant exactly once');
  a.match(await p.locator('#count').innerText(),/15 equipos/);a.equal(await p.locator('.card').count(),11);
  const eleven=p.getByRole('region',{name:'Serie iPhone 11',exact:true});a.equal(await eleven.locator('.card').count(),2);a.equal(await eleven.locator('.series-heading>span').innerText(),'6 equipos');
  await eleven.getByRole('button',{name:'Negro',exact:true}).click();const selected=eleven.locator('.card').filter({has:p.locator('.summary',{hasText:'128 GB · Negro'})});await selected.locator('.view').click();a((await p.locator('#specs').innerText()).includes('Negro'));await p.locator('#close').click();
  await p.locator('#sort').selectOption('model-desc');a.deepEqual(await titles(),['iPhone 13','iPhone 12','iPhone 11','Galaxy Z Fold','Galaxy Z Flip','Galaxy S26','Galaxy S25']);
  for(const mode of ['low','high']){await p.locator('#sort').selectOption(mode);a.equal(await p.locator('.catalog-series').count(),0);const values=await p.locator('.card .price').evaluateAll(es=>es.map(e=>Number(e.textContent.replace(/[^\d.]/g,''))));a.deepEqual(values,[...values].sort((x,y)=>mode==='low'?x-y:y-x),'price ordering remains global');}
  await p.locator('#sort').selectOption('model');await p.getByRole('button',{name:'Samsung',exact:true}).click();a.deepEqual(await titles(),expected.slice(3));
  await p.locator('#search').fill('Galaxy S25');a.deepEqual(await titles(),['Galaxy S25']);a.equal(await p.locator('.card').count(),2);
  await p.locator('#search').fill('no-existe');a.equal(await p.locator('.catalog-series').count(),0);a(await p.locator('#empty').isVisible());await p.locator('#reset').click();a.deepEqual(await titles(),expected);
  await p.locator('#capacity').selectOption('256 GB');a.deepEqual(await titles(),['iPhone 13']);a.equal(await p.locator('.card').count(),1);await p.locator('#capacity').selectOption('all');
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
   a(await p.locator('.series-products').evaluateAll(gs=>gs.every(g=>g.scrollWidth<=g.clientWidth+1)),'group grids keep their responsive card widths');
  }
  inventory={...inventory,updatedAt:new Date(Date.parse(inventory.updatedAt)+1000).toISOString(),products:[...products.filter(p=>!p.model.startsWith('iPhone 11')),{...products[1],id:'f'.repeat(20),model:'iPhone 14'}]};
  await p.clock.fastForward(301000);await p.waitForFunction(()=>[...document.querySelectorAll('.series-heading h3')].some(h=>h.textContent==='iPhone 14'));
  a(!(await titles()).includes('iPhone 11'),'empty series disappear after automatic inventory refresh');a((await titles()).includes('iPhone 14'),'new generation is grouped automatically');
  a.deepEqual(errors,[]);console.log('PASS '+type.name()+': generation/Flip/Fold groups, every variant and stock count, colors/details, ascending/descending series, global prices, brand/search/capacity/reset, responsive themes and automatic refresh.');
 }finally{await browser.close();}
}
(async()=>{if(process.env.TEST_WEBKIT!=='only')await run(chromium);if(process.env.TEST_WEBKIT)await run(webkit);})().catch(e=>{console.error(e);process.exitCode=1;});
