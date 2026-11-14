'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const source=require('../catalogo/inventory.json');
const first={...source.products[0],id:'11111111111111111111',color:'Blanco'},second={...first,id:'22222222222222222222',color:'Negro'};
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8800/catalogo/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let products=[first,second];
  await page.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:''}}));
  await page.route('**/inventory.json',r=>r.fulfill({json:{...source,updatedAt:new Date().toISOString(),products}}));
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedLink=text;}}});
  });
  await page.goto(base);await page.locator('.card').first().waitFor();
  assert.equal(await page.locator('.share-device').count(),await page.locator('.card').count());
  await page.locator('[data-variant-id="'+second.id+'"]').click();
  await page.locator('.share-device').first().click();
  await page.waitForFunction(()=>window.copiedLink);
  const link=await page.evaluate(()=>window.copiedLink),url=new URL(link);
  assert.equal(url.searchParams.get('equipo'),second.id);assert.match(url.searchParams.get('version'),/^[a-f0-9]{24}$/);
  assert.equal(await page.locator('#details').evaluate(n=>n.open),false,'copy does not open product');
  await page.goto(link);await page.locator('#details[open]').waitFor();
  assert.equal(await page.locator('#variant').inputValue(),second.id,'shared color is selected');
  assert.equal(new URL(page.url()).searchParams.has('equipo'),false,'shared selection is consumed from the address');
  assert.equal(new URL(page.url()).searchParams.has('version'),false);
  for(const exit of ['close','escape','backdrop']){
   if(exit!=='close'){await page.goto(link);await page.locator('#details[open]').waitFor();}
   if(exit==='close')await page.locator('#close').click();
   else if(exit==='escape')await page.keyboard.press('Escape');
   else await page.mouse.click(1,1);
   await page.locator('#details').waitFor({state:'hidden'});
   await page.reload();await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('#details').evaluate(n=>n.open),false,'refresh after '+exit+' stays in catalog');
   assert.equal(await page.locator('#products .color-swatch').count(),2,'full catalog remains after closing');
  }
  await page.goto(link);await page.locator('#details[open]').waitFor();await page.locator('#close').click();
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:async data=>{window.sharedData=data;},configurable:true}));
  await page.locator('.share-device').first().click();await page.waitForFunction(()=>window.sharedData);
  assert.equal(new URL(await page.evaluate(()=>window.sharedData.url)).searchParams.get('equipo'),second.id);
  products=[first,{...second,id:'33333333333333333333',priceCents:second.priceCents+1000}];
  await page.goto(link);await page.locator('#details[open]').waitFor();
  assert.equal(await page.locator('#variant').inputValue(),'33333333333333333333','link survives price/id change');
  products=[first];await page.goto(link);await page.getByRole('status').filter({hasText:'ya no está disponible'}).waitFor();
  assert.equal(await page.locator('#details').evaluate(n=>n.open),false,'removed device does not open a different color');
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   const share=page.locator('.share-device').first();await share.scrollIntoViewIfNeeded();
   const rect=await share.boundingBox(),card=await page.locator('.card').first().boundingBox();
   assert(rect.x>=card.x&&rect.x+rect.width<=card.x+card.width,'share stays inside card at '+width);
   assert(rect.height>=44,'touch target');
   assert.equal(await share.innerText(),'Compartir');
   const summary=await page.locator('.card .summary').first().boundingBox(),colors=await page.locator('.card .color-options').first().boundingBox();
   assert(rect.y>=summary.y+summary.height&&rect.y+rect.height<=colors.y,'share appears below device description at '+width);
  }
  if(process.env.CATALOG_PREVIEW_TEST_URL){
   const previewPage=await browser.newPage({viewport:{width:390,height:844}}),product=source.products[0];
   await previewPage.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:''}}));
   await previewPage.route('**/inventory.json',r=>r.fulfill({json:source}));
   await previewPage.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined});Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedLink=text;}}});});
   await previewPage.goto(process.env.CATALOG_PREVIEW_TEST_URL);await previewPage.locator('.card').first().waitFor();
   await previewPage.locator('[data-variant-id="'+product.id+'"]').click();
   await previewPage.locator('[data-product-id="'+product.id+'"] .share-device').click();await previewPage.waitForFunction(()=>window.copiedLink);
   const shared=await previewPage.evaluate(()=>window.copiedLink),manifest=await (await previewPage.request.get(new URL('share-pages.json',shared).origin+'/share-pages.json')).json();
   assert.equal(new URL(shared).pathname,'/equipo/'+product.id+'/');
   assert.equal(new URL(shared).searchParams.get('version'),manifest.products[product.id].signature);
   const response=await previewPage.request.get(shared),html=await response.text();assert.equal(response.status(),200);
   assert(html.includes('property="og:title" content="'+product.model+' '+product.capacity));
   assert(html.includes('property="og:image" content="https://lunivosv.com/assets/'));
   assert(html.includes('name="twitter:card" content="summary_large_image"'));
   await previewPage.goto(shared);await previewPage.locator('#details[open]').waitFor();
   assert.equal(await previewPage.locator('#variant').inputValue(),product.id);
   assert.equal(new URL(previewPage.url()).searchParams.has('equipo'),false);
   await previewPage.locator('#close').click();await previewPage.reload();
   await previewPage.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
   assert.equal(await previewPage.locator('#details').evaluate(n=>n.open),false,'preview link refresh stays in catalog after close');
   await previewPage.close();console.log('PASS: published preview URL, crawler-readable product metadata, matching signature and browser redirect to exact device.');
  }
  assert.deepEqual(errors,[]);console.log('PASS: copy, native share, exact color, direct opening, price updates, removed device and responsive share buttons.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
