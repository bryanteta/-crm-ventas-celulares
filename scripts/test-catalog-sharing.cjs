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
  await page.locator('#close').click();
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
  assert.deepEqual(errors,[]);console.log('PASS: copy, native share, exact color, direct opening, price updates, removed device and responsive share buttons.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
