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
  const choose=async name=>{if(p.viewportSize().width<=760&&!await p.locator('#version-drawer').evaluate(d=>d.open))await p.locator('#versions-open').click();await p.locator('#version-list').getByRole('button',{name,exact:true}).click();};
  const expected=['iPhone 11','iPhone 12','iPhone 13','Galaxy S25','Galaxy S26','Galaxy Z Flip','Galaxy Z Fold'];a.deepEqual(await titles(),expected);
  const ids=await p.locator('#products .color-swatch').evaluateAll(bs=>bs.map(b=>b.dataset.variantId));a.deepEqual(ids.sort(),products.map(p=>p.id).sort(),'grouping preserves every source variant exactly once');
  a.match(await p.locator('#count').innerText(),/15 equipos/);a.equal(await p.locator('.card').count(),11);
  const eleven=p.getByRole('region',{name:'Serie iPhone 11',exact:true});a.deepEqual(await eleven.locator('.model-version>h4').allTextContents(),['Estándar','Pro Max']);a.deepEqual(await p.getByRole('region',{name:'Serie Galaxy S25',exact:true}).locator('.model-version>h4').allTextContents(),['FE','Ultra']);a.equal(await eleven.locator('.card').count(),2);a.equal(await eleven.locator('.series-heading>span').innerText(),'6 equipos');
  await eleven.getByRole('button',{name:'Negro',exact:true}).click();const selected=eleven.locator('.card').filter({has:p.locator('.summary',{hasText:'128 GB · Negro'})});await selected.locator('.view').click();a((await p.locator('#specs').innerText()).includes('Negro'));await p.locator('#close').click();
  await p.getByRole('button',{name:'iPhone',exact:true}).click();a(await p.locator('#version-drawer').evaluate(d=>d.open));a.equal(await p.locator('#version-list .version-option').count(),5);
  await choose('iPhone 13 Pro');a.equal(await p.locator('.product-name').innerText(),'iPhone 13 Pro');a.equal(await p.locator('#version-selection').innerText(),'iPhone 13 Pro');await p.locator('.view').click();a.equal(await p.locator('#detail-title').innerText(),'iPhone 13 Pro');await p.locator('#close').click();
  await choose('Todos los iPhone');a.deepEqual(await titles(),expected.slice(0,3));await p.getByRole('button',{name:'Todos',exact:true}).click();
  await p.locator('#sort').selectOption('model-desc');a.deepEqual(await titles(),['iPhone 13','iPhone 12','iPhone 11','Galaxy Z Fold','Galaxy Z Flip','Galaxy S26','Galaxy S25']);
  for(const mode of ['low','high']){await p.locator('#sort').selectOption(mode);a.equal(await p.locator('.catalog-series').count(),0);const values=await p.locator('.card .price').evaluateAll(es=>es.map(e=>Number(e.textContent.replace(/[^\d.]/g,''))));a.deepEqual(values,[...values].sort((x,y)=>mode==='low'?x-y:y-x),'price ordering remains global');}
  await p.locator('#sort').selectOption('model');await p.getByRole('button',{name:'Samsung',exact:true}).click();a.deepEqual(await titles(),expected.slice(3));
  a(await p.locator('#version-drawer').evaluate(d=>d.open),'brand selection opens a mobile side panel');
  a.equal(await p.locator('#version-list .version-option').count(),6,'all Samsung versions remain available');
  await choose('Galaxy S25 Ultra');a.equal(await p.locator('.card').count(),1);a.equal(await p.locator('.product-name').innerText(),'Samsung S25 Ultra');a(!await p.locator('#version-drawer').evaluate(d=>d.open));
  await p.getByRole('button',{name:'Samsung',exact:true}).click();a.equal(await p.locator('#version-selection').innerText(),'Galaxy S25 Ultra','reopening the selected brand preserves its version');await p.locator('#versions-close').click();
  await choose('Ver serie Galaxy S25');a.equal(await p.locator('.card').count(),2);a.equal(await p.locator('#version-list .version-option').count(),6,'version filtering never removes other navigation choices');
  await p.locator('#versions-clear').click();a.deepEqual(await titles(),expected.slice(3));
  await p.locator('#versions-open').click();await p.keyboard.press('Escape');a(!await p.locator('#version-drawer').evaluate(d=>d.open));
  await p.locator('#versions-open').click();await p.mouse.click(385,180);a(!await p.locator('#version-drawer').evaluate(d=>d.open),'backdrop dismisses the version panel');
  await p.locator('#versions-open').click();await p.setViewportSize({width:1280,height:900});await p.waitForFunction(()=>!document.querySelector('#version-drawer').open);a(!await p.locator('#version-drawer').evaluate(d=>d.open));a(await p.locator('#version-sidebar').isVisible(),'drawer becomes a desktop sidebar on resize');
  const keyboardVersion=p.locator('#version-list').getByRole('button',{name:'Galaxy S26 Plus',exact:true});await keyboardVersion.focus();await p.keyboard.press('Enter');a.equal(await p.locator('.product-name').innerText(),'Samsung S26 Plus');a(await keyboardVersion.evaluate(b=>b===document.activeElement),'desktop selection keeps keyboard focus');
  await p.setViewportSize({width:390,height:844});await p.locator('#versions-clear').click();
  await p.locator('#search').fill('Galaxy S25');a.deepEqual(await titles(),['Galaxy S25']);a.equal(await p.locator('.card').count(),2);
  await p.locator('#search').fill('no-existe');a.equal(await p.locator('.catalog-series').count(),0);a(await p.locator('#empty').isVisible());await p.locator('#reset').click();a.deepEqual(await titles(),expected);
  await p.locator('#capacity').selectOption('256 GB');a.deepEqual(await titles(),['iPhone 13']);a.equal(await p.locator('.card').count(),1);await p.locator('#capacity').selectOption('all');
  for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await p.getByRole('button',{name:'Samsung',exact:true}).click();
   if(width<=760){a(await p.locator('#version-drawer').evaluate(d=>d.open));await p.locator('#versions-close').click();a(await p.locator('#versions-open').isVisible());}
   else{a(await p.locator('#version-sidebar').isVisible());a(!await p.locator('#version-drawer').evaluate(d=>d.open));}
   a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');
   a(await p.locator('.series-products,.version-products').evaluateAll(gs=>gs.every(g=>g.scrollWidth<=g.clientWidth+1)),'version grids keep their responsive card widths');
   await p.getByRole('button',{name:'Todos',exact:true}).click();a(!await p.locator('#version-sidebar').isVisible());
  }
  await p.setViewportSize({width:844,height:390});await p.getByRole('button',{name:'Samsung',exact:true}).click();
  a(await p.locator('#version-list').evaluate(n=>n.scrollHeight>n.clientHeight),'short screens scroll the version list internally');
  await choose('Galaxy S25 Ultra');
  inventory={...inventory,updatedAt:new Date(Date.parse(inventory.updatedAt)+1000).toISOString(),products:[...products.filter(p=>!p.model.startsWith('iPhone 11')&&p.model!=='Samsung S25 Ultra'),{...products[1],id:'f'.repeat(20),model:'iPhone 14'}]};
  await p.clock.fastForward(301000);await p.waitForFunction(()=>document.querySelector('#version-selection').textContent==='Galaxy S25');
  a.equal(await p.locator('.product-name').innerText(),'Samsung S25 FE','a removed selected version falls back to its available series');
  a.equal(await p.locator('#version-list button').filter({hasText:'Galaxy S25 Ultra'}).count(),0);
  await p.getByRole('button',{name:'Todos',exact:true}).click();
  a(!(await titles()).includes('iPhone 11'),'empty series disappear after automatic inventory refresh');a((await titles()).includes('iPhone 14'),'new generation is grouped automatically');
  a.deepEqual(errors,[]);console.log('PASS '+type.name()+': series and versions, iPhone/Samsung sidebars, mobile selection/Escape/backdrop/rotation, keyboard focus, stock/filters/prices, responsive themes and automatic version updates.');
 }finally{await browser.close();}
}
(async()=>{if(process.env.TEST_WEBKIT!=='only')await run(chromium);if(process.env.TEST_WEBKIT)await run(webkit);})().catch(e=>{console.error(e);process.exitCode=1;});
