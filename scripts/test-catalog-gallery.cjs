'use strict';
const {chromium,webkit}=require('playwright'),a=require('node:assert/strict');
const source=require('../catalogo/inventory.json'),pictures=require('../catalogo/product-images.json');
const origin='http://127.0.0.1:8000/catalogo/';
const output=require('node:path').resolve(process.env.GALLERY_ARTIFACT_DIR||'test-results/gallery');require('node:fs').mkdirSync(output,{recursive:true});
const base={...source.products[0],capacity:'64 GB',condition:'Seminuevo',grade:'A',battery:'100%',quantity:1,priceCents:30000,observations:[]};
const inventory={...source,updatedAt:new Date().toISOString(),products:[{...base,id:'a'.repeat(20),manufacturer:'Apple',model:'iPhone 11',color:'Blanco'},{...base,id:'b'.repeat(20),manufacturer:'Apple',model:'iPhone 11',color:'Negro'},{...base,id:'c'.repeat(20),manufacturer:'Samsung',model:'Samsung S26 Ultra',color:'Celeste',capacity:'256 GB',battery:''}]};
async function run(browserType,options){
 const browser=await browserType.launch(options);try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:''}}));
 await p.route(origin+'inventory.json',r=>r.fulfill({json:inventory}));
 await p.goto(origin);await p.locator('.view').first().click();await p.locator('#gallery-photo').evaluate(img=>img.decode());
 a.equal(await p.locator('#gallery-counter').innerText(),'1 / 3');a.equal(await p.locator('#gallery-thumbs button').count(),3);
 await p.locator('#gallery-next').click();a.equal(await p.locator('#gallery-caption').innerText(),'Detalle de cámaras');
 await p.locator('#gallery-prev').click();a.equal(await p.locator('#gallery-caption').innerText(),'Vista general');
 await p.locator('#gallery-thumbs button').last().click();a.equal(await p.locator('#gallery-caption').innerText(),'Detalle de pantalla');
 await p.locator('#gallery-next').click();a.equal(await p.locator('#gallery-counter').innerText(),'1 / 3');
 await p.locator('#gallery-open').focus();await p.keyboard.press('ArrowRight');a.equal(await p.locator('#gallery-counter').innerText(),'2 / 3');
 await p.locator('#gallery-open').click();a(await p.locator('#photo-viewer').isVisible());a(await p.locator('#details').isVisible());
 await p.locator('#zoom-in').click();a.equal(await p.locator('#zoom-level').innerText(),'150%');a(await p.locator('#zoom-viewport').evaluate(n=>n.scrollWidth>n.clientWidth));
 const panBox=await p.locator('#zoom-viewport').boundingBox(),panBefore=await p.locator('#zoom-viewport').evaluate(n=>n.scrollLeft);await p.mouse.move(panBox.x+panBox.width/2,panBox.y+panBox.height/2);await p.mouse.down();await p.mouse.move(panBox.x+panBox.width/2-50,panBox.y+panBox.height/2-40,{steps:4});await p.mouse.up();a.notEqual(await p.locator('#zoom-viewport').evaluate(n=>n.scrollLeft),panBefore,'enlarged photo can be dragged');
 for(let i=0;i<5;i++)await p.locator('#zoom-in').click();a.equal(await p.locator('#zoom-level').innerText(),'400%');a(await p.locator('#zoom-in').isDisabled());
 await p.locator('#zoom-reset').click();a.equal(await p.locator('#zoom-level').innerText(),'100%');a(await p.locator('#zoom-out').isDisabled());
 await p.locator('#zoom-next').click();a((await p.locator('#zoom-counter').innerText()).includes('Detalle de pantalla'));
 await p.keyboard.press('Escape');a(!(await p.locator('#photo-viewer').isVisible()));a(await p.locator('#details').isVisible());
 const colors=await p.locator('#detail-colors button').count();if(colors>1){await p.locator('#detail-colors button').nth(1).click();a.equal(await p.locator('#gallery-counter').innerText(),'1 / 3');a((await p.locator('#gallery-photo').getAttribute('alt')).includes(await p.locator('#detail-colors button').nth(1).getAttribute('aria-label')));}
 // Exercise all widths/themes without changing the inventory or selected price.
 await p.locator('[name=payment][value=installments]').check();await p.evaluate(()=>{const s=document.querySelector('#payment-bank');s.value='cuscatlan';s.dispatchEvent(new Event('change',{bubbles:true}));});await p.locator('[name=installment-term][value="36"]').check();
 const price=await p.locator('#detail-price').innerText();
 for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
  a(await p.locator('#details').evaluate(d=>d.scrollWidth<=d.clientWidth+1),'no horizontal dialog overflow');
  await p.locator('#gallery-open').click();await p.locator('#zoom-in').click();
  a(await p.locator('#photo-viewer').evaluate(d=>d.scrollWidth<=d.clientWidth+1),'zoom scroll stays inside viewport');
  a(await p.locator('#zoom-photo').evaluate(img=>img.getBoundingClientRect().width>0),'zoom photo has dimensions');
  await p.locator('#zoom-close').click();a.equal(await p.locator('#detail-price').innerText(),price);a.equal(await p.locator('#payment-bank').inputValue(),'cuscatlan');a(await p.locator('[name=installment-term][value="36"]').isChecked());
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>document.documentElement.dataset.theme='light');
 await p.locator('#details').evaluate(d=>d.scrollTop=0);await p.screenshot({path:require('node:path').join(output,'catalog-gallery-'+browserType.name()+'.png')});
 // Official Samsung metadata supplies real front/back/lateral photos.
 await p.locator('#close').click();await p.locator('#search').fill('Samsung S26 Ultra');await p.locator('.view').first().click();
 a((await p.locator('#gallery-thumbs button').count())>=3);const labels=await p.locator('#gallery-thumbs button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')));a(labels.includes('Parte posterior'));a(labels.includes('Frente'));
 await p.locator('#gallery-thumbs button[aria-label="Parte posterior"]').click();
 a((await p.locator('#gallery-photo').getAttribute('alt')).includes('Samsung S26 Ultra'));await p.locator('#gallery-photo').evaluate(img=>img.decode());
 await p.locator('#gallery-open').click();await p.locator('#zoom-photo').evaluate(img=>img.decode());
 if(browserType===chromium){
  const cdp=await context.newCDPSession(p),box=await p.locator('#zoom-viewport').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const points=distance=>[{x:x-distance,y,radiusX:3,radiusY:3,id:1},{x:x+distance,y,radiusX:3,radiusY:3,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(30)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(40)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(65)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});a.notEqual(await p.locator('#zoom-level').innerText(),'100%','pinch zoom works');
  await p.locator('#zoom-reset').click();await p.locator('#zoom-close').click();
  await p.locator('#gallery-open').scrollIntoViewIfNeeded();const s=await p.locator('#gallery-open').boundingBox(),before=await p.locator('#gallery-counter').innerText();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:s.x+s.width*.8,y:s.y+s.height/2,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:s.x+s.width*.2,y:s.y+s.height/2,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});a.notEqual(await p.locator('#gallery-counter').innerText(),before,'swipe advances photo');a(!(await p.locator('#photo-viewer').isVisible()),'swipe does not also open zoom');await p.locator('#gallery-open').focus();await p.keyboard.press('Enter');a(await p.locator('#photo-viewer').isVisible(),'keyboard zoom still works after swiping');await p.locator('#zoom-close').click();
 }else await p.locator('#zoom-close').click();
 await p.locator('#close').click();
 // A photo from another color, remote URL or malformed entry cannot enter a gallery.
 const first=inventory.products[0],key=first.model+'|'+first.color,original=pictures.products[key];
 await p.route('**/product-images.json',r=>r.fulfill({json:{version:2,products:{[key]:{...original,gallery:[{...original,path:'https://untrusted.invalid/wrong.jpg',label:'Wrong'},{...original,color:'Another color',path:'assets/products/wrong-color.jpg',label:'Wrong color'}]}}}}));
 await p.reload();await p.locator('.view').first().click();a.equal(await p.locator('#gallery-thumbs button').count(),3);a.equal(await p.getByRole('button',{name:'Wrong',exact:true}).count(),0);await p.locator('#close').click();
 await p.route('**/product-images.json',r=>r.fulfill({json:{version:2,products:{}}}));await p.reload();await p.locator('.view').first().click();a(await p.locator('#gallery-empty').isVisible());a(!(await p.locator('#gallery-open').isVisible()));a(!(await p.locator('#gallery-controls').isVisible()));
 await p.locator('#close').click();await p.route('**/product-images.json',r=>r.fulfill({json:{version:2,products:{[key]:{...original,path:'assets/products/photo-unavailable.jpg',gallery:[]}}}}));await p.route('**/photo-unavailable.jpg*',r=>r.fulfill({status:404,body:''}));await p.reload();await p.locator('.view').first().click();await p.locator('#gallery-empty').waitFor({state:'visible'});a(await p.locator('#gallery-open').isDisabled());a((await p.locator('#gallery-empty').innerText()).includes('No pudimos cargar'));await p.locator('#gallery-next').click();a.equal(await p.locator('#gallery-counter').innerText(),'2 / 3');
 a.deepEqual(errors,[]);console.log('PASS '+browserType.name()+': exact-color gallery, official perspectives, close-ups, wrap, keyboard, thumbnails, zoom controls, pinch/swipe, nested dialogs, color reset, unchanged payments, responsive themes and safe missing/invalid images.');
 }finally{await browser.close()}
}
(async()=>{if(process.env.TEST_WEBKIT!=='only')await run(chromium,{executablePath:process.env.CI?undefined:'/usr/bin/chromium',args:['--no-sandbox']});if(process.env.TEST_WEBKIT)await run(webkit,{});})().catch(e=>{console.error(e);process.exitCode=1});
