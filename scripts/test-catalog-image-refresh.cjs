'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const source=require('../catalogo/inventory.json'),art=require('../catalogo/product-images.json');
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8800/catalogo/';
const endpoint='https://lunivo-inventory.bra0307h.workers.dev/inventory.json';
const first={...source.products[0],id:'11111111111111111111',manufacturer:'Apple',model:'iPhone 11',color:'Blanco',capacity:'128 GB',priceCents:30000,quantity:1};
const next={...first,id:'22222222222222222222',model:'iPhone 14 Pro Max',color:'Plata'};
const initial={version:2,products:{[first.model+'|'+first.color]:art.products[first.model+'|'+first.color]}};
const complete={version:2,products:{...initial.products,[next.model+'|'+next.color]:art.products[next.model+'|'+next.color]}};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const initialFailure of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
   let products=[first],imageRequests=0;
   await page.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint}}));
   await page.route('**/inventory.json',r=>r.fulfill({json:{...source,updatedAt:new Date().toISOString(),products}}));
   await page.route('**/product-images.json',r=>{imageRequests++;return initialFailure&&imageRequests===1?r.fulfill({status:503,body:'temporarily unavailable'}):r.fulfill({json:imageRequests===1?initial:complete});});
   await require('./catalog-test-fixtures.cjs').withoutCustomizations(page);await page.goto(base);await page.locator('.card').waitFor();
   if(initialFailure)assert.equal(await page.locator('.product-image').isVisible(),false);
   else products=[first,next];
   await page.clock.runFor(121000);
   const id=initialFailure?first.id:next.id;
   await page.locator('[data-product-id="'+id+'"] .product-image:not([hidden])').waitFor();
   assert.equal(imageRequests,2,initialFailure?'failed image manifest retries on the next refresh':'new inventory requests new photo manifest without reload');
   assert.equal(new URL(page.url()).pathname,new URL(base).pathname);assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: photos follow newly arrived devices without reload; temporary manifest failures recover on the next inventory refresh.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
