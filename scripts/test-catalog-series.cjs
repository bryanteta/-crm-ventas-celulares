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
  await p.goto(process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/');await p.locator('.card').first().waitFor();
  const titles=()=>p.locator('.series-heading h3').allTextContents();
  const choose=async name=>{
   let model;
   if(name.startsWith('Todos los ')){model='all';await p.getByRole('button',{name:name.endsWith('iPhone')?'iPhone':'Samsung',exact:true}).click();}
   else{const button=p.locator('#version-list').getByRole('button',{name,exact:true});model=await button.getAttribute('data-version');await button.click();}
   await p.waitForFunction(model=>{const root=document.querySelector('#products'),target=model==='all'?root:[...root.querySelectorAll('.model-version')].find(n=>n.dataset.versionModel===model)||[...root.querySelectorAll('.card')].find(n=>n.dataset.versionModel===model);if(!target)return false;const nav=document.querySelector('#catalog-navigation').getBoundingClientRect(),r=target.getBoundingClientRect();return nav.top<=1&&r.top>=nav.bottom-2&&r.top<nav.bottom+70;},model);
  };
  const expected=['iPhone 11','iPhone 12','iPhone 13','Galaxy S25','Galaxy S26','Galaxy Z Flip','Galaxy Z Fold'];a.deepEqual(await titles(),expected);
  a(!await p.locator('#version-bar').isVisible());a.equal(await p.locator('#version-drawer,#version-sidebar').count(),0,'the side panel is removed');
  const ids=await p.locator('#products .color-swatch').evaluateAll(bs=>bs.map(b=>b.dataset.variantId));a.deepEqual(ids.sort(),products.map(p=>p.id).sort());a.match(await p.locator('#count').innerText(),/15 equipos/);
  a.deepEqual(await p.getByRole('region',{name:'Serie iPhone 11',exact:true}).locator('.model-version>h4').allTextContents(),['Estándar','Pro Max']);
  await p.getByRole('button',{name:'iPhone',exact:true}).click();a(await p.locator('#version-bar').isVisible());a.equal(await p.locator('#version-list button').count(),5);
  const appleCards=await p.locator('.card').evaluateAll(cs=>cs.map(c=>c.dataset.productId));
  await choose('iPhone 12');a.deepEqual(await p.locator('.card').evaluateAll(cs=>cs.map(c=>c.dataset.productId)),appleCards,'navigation keeps all brand devices in the same DOM');
  const before=await p.evaluate(()=>scrollY);await p.evaluate(()=>scrollBy({top:600,behavior:'instant'}));a(await p.evaluate(()=>scrollY)>before,'the visitor can keep scrolling after jumping');
  a(await p.getByRole('region',{name:'Versión iPhone 13 Mini',exact:true}).evaluate(n=>{const r=n.getBoundingClientRect();return r.top<innerHeight&&r.bottom>document.querySelector('#catalog-navigation').getBoundingClientRect().bottom;}),'the following version remains in the scrollable catalog');
  a(await p.locator('#catalog-navigation').evaluate(n=>Math.abs(n.getBoundingClientRect().top)<2),'brand/model navigation stays at the top while browsing');
  await p.waitForFunction(()=>document.querySelector('#version-list [aria-pressed=true]')?.dataset.version==='iPhone 13 Mini');
  await choose('iPhone 13 Pro');await p.waitForFunction(()=>document.querySelector('#version-list [aria-pressed=true]')?.dataset.version==='iPhone 13 Pro');a.equal(await p.locator('.card').count(),5);a.equal(await p.locator('#version-list [aria-pressed=true]').getAttribute('aria-label'),'iPhone 13 Pro');
  a(await p.locator('#version-list [aria-pressed=true]').evaluate(b=>{const r=b.getBoundingClientRect(),n=b.parentElement.getBoundingClientRect();return r.left>=n.left-1&&r.right<=n.right+1;}),'the current model remains visible in the compact strip');
  await p.getByRole('region',{name:'Versión iPhone 13 Pro',exact:true}).locator('.view').click();a.equal(await p.locator('#detail-title').innerText(),'iPhone 13 Pro');await p.locator('#close').click();
  await choose('Todos los iPhone');a.deepEqual(await titles(),expected.slice(0,3));await p.getByRole('button',{name:'Todos',exact:true}).click();
  await p.locator('#sort').selectOption('model-desc');a.deepEqual(await titles(),['iPhone 13','iPhone 12','iPhone 11','Galaxy Z Fold','Galaxy Z Flip','Galaxy S26','Galaxy S25']);
  for(const mode of ['low','high']){await p.locator('#sort').selectOption(mode);const values=await p.locator('.card .price').evaluateAll(es=>es.map(e=>Number(e.textContent.replace(/[^\d.]/g,''))));a.deepEqual(values,[...values].sort((x,y)=>mode==='low'?x-y:y-x));}
  await p.locator('#sort').selectOption('model');await p.getByRole('button',{name:'Samsung',exact:true}).click();a.deepEqual(await titles(),expected.slice(3));a.equal(await p.locator('#version-list button').count(),6);
  await choose('Galaxy S25 Ultra');a.equal(await p.locator('.card').count(),6,'jumping to Ultra keeps every other Samsung model');a.equal(await p.locator('#version-list button').count(),6);
  await p.locator('#sort').selectOption('high');await choose('Galaxy S25 FE');const orderedPrices=await p.locator('.card .price').evaluateAll(es=>es.map(e=>Number(e.textContent.replace(/[^\d.]/g,''))));a.deepEqual(orderedPrices,[...orderedPrices].sort((a,b)=>b-a),'navigation preserves price sorting and the full list');await p.locator('#sort').selectOption('model');
  await p.getByRole('button',{name:'Samsung',exact:true}).click();a.deepEqual(await titles(),expected.slice(3),'brand tap restores all of its versions in one step');a.equal(await p.locator('#version-list').evaluate(n=>n.scrollLeft),0);
  await choose('Todos los Samsung');a.deepEqual(await titles(),expected.slice(3));
  const chip=p.locator('#version-list').getByRole('button',{name:'Galaxy S26 Plus',exact:true});await chip.focus();await p.keyboard.press('ArrowRight');a.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Galaxy Z Flip 4');await p.keyboard.press('Enter');a.equal(await p.locator('.card').count(),6);a.equal(await p.evaluate(()=>document.activeElement.dataset.versionModel),'Samsung Z Flip 4','keyboard navigation moves focus to the destination');
  await choose('Todos los Samsung');await p.locator('#search').fill('Galaxy S25');a.deepEqual(await titles(),['Galaxy S25']);await choose('Galaxy Z Flip 6');a.equal(await p.locator('#search').inputValue(),'','a hidden destination clears the restrictive search');a.equal(await p.locator('.card').count(),6);await p.locator('#search').fill('no-existe');a(await p.locator('#empty').isVisible());await p.locator('#reset').click();a.deepEqual(await titles(),expected);a(!await p.locator('#version-bar').isVisible());
  await p.locator('#capacity').selectOption('256 GB');a.deepEqual(await titles(),['iPhone 13']);await p.getByRole('button',{name:'iPhone',exact:true}).click();await choose('iPhone 11');a.equal(await p.locator('#capacity').inputValue(),'all');a.equal(await p.locator('.card').count(),5);await p.getByRole('button',{name:'Todos',exact:true}).click();
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.getByRole('button',{name:'Samsung',exact:true}).click();
   a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'the horizontal strip never widens the page');
   const layout=await p.locator('#version-list button').evaluateAll(bs=>bs.map(b=>Math.round(b.getBoundingClientRect().top)));a(layout.every(y=>Math.abs(y-layout[0])<=1),'all chips stay in a single horizontal row');
   if(width<=390)a(await p.locator('#version-list').evaluate(n=>n.scrollWidth>n.clientWidth),'mobile versions scroll horizontally');
   a(await p.locator('.version-products').evaluateAll(gs=>gs.every(g=>g.scrollWidth<=g.clientWidth+1)));await p.getByRole('button',{name:'Todos',exact:true}).click();
  }
  await p.getByRole('button',{name:'Samsung',exact:true}).click();await choose('Galaxy S25 Ultra');
  inventory={...inventory,updatedAt:new Date(Date.parse(inventory.updatedAt)+1000).toISOString(),products:[...products.filter(p=>!p.model.startsWith('iPhone 11')&&p.model!=='Samsung S25 Ultra'),{...products[1],id:'f'.repeat(20),model:'iPhone 14'}]};
  await p.clock.fastForward(301000);await p.waitForFunction(()=>![...document.querySelectorAll('#version-list button')].some(b=>b.dataset.version==='Samsung S25 Ultra'));a.equal(await p.locator('#version-list').getByRole('button',{name:'Galaxy S25 Ultra',exact:true}).count(),0);
  await p.getByRole('button',{name:'Todos',exact:true}).click();a(!(await titles()).includes('iPhone 11'));a((await titles()).includes('iPhone 14'));a.deepEqual(errors,[]);
  console.log('PASS '+type.name()+': compact sticky brand/model navigation, shorter labels, jump offsets, continued scrolling, full catalog, keyboard, filters/prices, responsive themes and live updates.');
 }finally{await browser.close();}
}
(async()=>{if(process.env.TEST_WEBKIT!=='only')await run(chromium);if(process.env.TEST_WEBKIT)await run(webkit);})().catch(e=>{console.error(e);process.exitCode=1});
