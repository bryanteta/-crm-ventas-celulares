'use strict';
const {chromium}=require('playwright'),a=require('node:assert/strict'),source=require('../catalogo/inventory.json');
(async()=>{const b=await chromium.launch({executablePath:process.env.CI?undefined:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [320,1280]){const p=await b.newPage({viewport:{width,height:900},hasTouch:width<701}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.addInitScript(()=>{Math.random=()=>0;});const now=Date.now(),date=days=>new Date(now-days*86400000).toISOString(),base={...source.products[0],manufacturer:'Apple',condition:'Seminuevo',grade:'A',battery:'100%',observations:[],cycles:null,sim:'Por confirmar',ram:'',box:null,capacity:'128 GB',priceCents:40000,quantity:1,available:true};const products=[{...base,id:'1'.repeat(20),model:'iPhone 11',color:'Blanco',sourceInitials:['T'],addedAt:date(1)},{...base,id:'2'.repeat(20),model:'iPhone 12',color:'Negro',sourceInitials:['S'],addedAt:date(2)},{...base,id:'3'.repeat(20),model:'iPhone 13',color:'Negro',sourceInitials:['J'],addedAt:date(30)},{...base,id:'4'.repeat(20),model:'iPhone 11',color:'Negro',sourceInitials:['T'],addedAt:date(30)}];await p.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:'https://fixture.workers.dev/inventory.json'}}));await p.route('https://fixture.workers.dev/inventory.json',r=>r.fulfill({json:{...source,updatedAt:date(0),products:products.map(({addedAt,...p})=>p)}}));await p.route('**/catalogo/inventory.json',r=>r.fulfill({json:{...source,updatedAt:date(.01),products}}));await p.goto(process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/');await p.locator('#products .card').first().waitFor();
const recent=p.locator('#recent-arrivals');
a.equal(await p.locator('#recent-filter').count(),0,'there is no recent-items button');
a(await recent.isVisible());
a.deepEqual(await recent.locator('.product-name').allTextContents(),['iPhone 11','iPhone 12']);
a.equal(await recent.locator('.card').first().locator('.color-swatch').count(),1,'old colors do not become new when a sibling is added');
a(await p.evaluate(()=>Boolean(document.querySelector('#recent-arrivals').compareDocumentPosition(document.querySelector('#products'))&Node.DOCUMENT_POSITION_FOLLOWING)),'recent section precedes the complete catalog');
a.equal(await p.locator('#products .card').count(),3,'the complete inventory remains below');
const rail=p.locator('#recent-products');
await rail.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
await p.clock.runFor(100);
const cardWidth=(await rail.locator('.card').first().boundingBox()).width;
if(width<701){
 a(await rail.evaluate(e=>e.scrollWidth>e.clientWidth));
 a(Math.abs(cardWidth-(await rail.boundingBox()).width*.8)<2,'existing mobile card width is preserved');
 await p.clock.runFor(1500);a(await rail.evaluate(e=>e.scrollLeft)>2,'the visible mobile row gently moves');
 a.equal((await rail.locator('.card').first().boundingBox()).width,cardWidth);
 await p.emulateMedia({reducedMotion:'reduce'});const reducedLeft=await rail.evaluate(e=>e.scrollLeft);await p.clock.runFor(1800);a.equal(await rail.evaluate(e=>e.scrollLeft),reducedLeft,'reduced motion disables the hint');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.clock.runFor(1300);
 const r=await rail.boundingBox();await p.touchscreen.tap(r.x+4,r.y+r.height-4);
 const touchedLeft=await rail.evaluate(e=>e.scrollLeft);await p.clock.runFor(6000);a.equal(await rail.evaluate(e=>e.scrollLeft),touchedLeft,'the first real touch stops motion without jumping back');
 await rail.evaluate(e=>e.scrollLeft+=35);const manualLeft=await rail.evaluate(e=>e.scrollLeft);await p.clock.runFor(1500);a.equal(await rail.evaluate(e=>e.scrollLeft),manualLeft,'manual horizontal scrolling remains available');
 await p.getByRole('button',{name:'iPhone',exact:true}).click();await p.getByRole('button',{name:'Todos',exact:true}).click();const refreshedLeft=await rail.evaluate(e=>e.scrollLeft);await p.clock.runFor(4000);a.equal(await rail.evaluate(e=>e.scrollLeft),refreshedLeft,'rendering does not restart motion after interaction');
}else{await p.clock.runFor(2000);a.equal(await rail.evaluate(e=>e.scrollLeft),0,'desktop stays still');}
await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));

a.match(await p.locator('#viewer-count').innerText(),/^1 persona viendo ahora$/);
await p.evaluate(()=>{Math.random=()=>.999999;});await p.clock.fastForward(25000);a.match(await p.locator('#viewer-count').innerText(),/^6 personas viendo ahora$/);
await p.reload();await p.locator('#products .card').first().waitFor();a.equal(await p.locator('#viewer-count').innerText(),'6 personas viendo ahora','reloading preserves the counter');
await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await p.clock.runFor(200);await p.locator('#viewer-bubble').waitFor({state:'visible',timeout:5000});a(await p.locator('#viewer-bubble').isVisible());const bubble=await p.locator('#viewer-bubble').boundingBox();a(bubble.y>=0&&bubble.y<40);a(Math.abs(bubble.x+bubble.width-width+16)<2,'bubble is at the upper right');a.equal(await p.locator('#viewer-bubble-count').innerText(),'6 viendo ahora');
a.equal(await p.locator('.recent-swipe-hint').count(),0,'no swipe-help text');

for(const [model,initial]of [['iPhone 11','T'],['iPhone 12','S'],['iPhone 13','J']]){const card=p.locator('#products .card[data-version-model="'+model+'"]');a.equal(await card.locator('.manufacturer').textContent(),'iPhone · Lunivo');a((await card.locator('.image-caption').innerText()).endsWith(' · '+initial));await card.locator('.view').click();a.equal(await p.locator('#consult-label').innerText(),'Consultar este equipo');await p.locator('#close').click();}
await recent.locator('.view').first().click();a.equal(await p.locator('#detail-title').innerText(),'iPhone 11');await p.locator('#close').click();
await p.getByRole('button',{name:'iPhone',exact:true}).click();a(!await recent.isVisible());a.equal(await p.locator('#products .card').count(),3);
await p.getByRole('button',{name:'Todos',exact:true}).click();a(await recent.isVisible());await p.locator('#search').fill('inexistente');a(!await recent.isVisible());a(await p.locator('#empty').isVisible());await p.locator('#reset').click();a(await recent.isVisible());a.equal(await p.locator('#products .card').count(),3);a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));a.deepEqual(errors,[]);await recent.scrollIntoViewIfNeeded();await p.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'lunivo-recent-section-'+width+'.png')});await p.close();}console.log('PASS: recent section precedes the complete inventory with no button, correct arrivals, initials only on photos, persistent counter and top-right bubble, gentle mobile motion stopping on touch, unchanged card width, reduced-motion support, and responsive filters.');}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
