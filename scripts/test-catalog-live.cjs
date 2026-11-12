'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),source=require('../catalogo/inventory.json');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const origin='http://127.0.0.1:8000/catalogo/',edge='https://lunivo-inventory.fixture.workers.dev/inventory.json',stamp=Date.now();let mode='live',edgeCalls=0,backupCalls=0,imageCalls=0;
 const backup={...structuredClone(source),updatedAt:new Date(stamp-30*60*1000).toISOString()};const live=structuredClone(source);live.updatedAt=new Date(stamp).toISOString();live.products[0].quantity+=7;
 const page=await browser.newPage({viewport:{width:412,height:915}});await page.clock.install();
 await page.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:edge}}));
 await page.route(origin+'inventory.json',r=>{backupCalls++;return r.fulfill({json:backup})});
 await page.route(edge,r=>{edgeCalls++;if(mode==='fail')return r.fulfill({status:503,json:{error:'unavailable'}});return r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:mode==='stale'?{...live,updatedAt:new Date(stamp-60*60*1000).toISOString()}:live})});
 await page.route('**/product-images.json',r=>r.fulfill({json:++imageCalls===1?{version:2,products:{}}:require('../catalogo/product-images.json')}));
 await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
 const total=data=>data.products.reduce((n,p)=>n+p.quantity,0);assert((await page.locator('#count').innerText()).includes(String(total(live))));assert.equal(backupCalls,0);
 await page.locator('.view').first().click();const selected=await page.locator('#variant').inputValue(),price=await page.locator('#detail-price').innerText();const calls=edgeCalls;await page.clock.fastForward(2*60*1000);assert.equal(edgeCalls,calls,'open sale details do not change under the customer');assert.equal(await page.locator('#variant').inputValue(),selected);assert.equal(await page.locator('#detail-price').innerText(),price);await page.locator('#close').click();
 assert.equal(await page.locator('.product-image').first().getAttribute('src'),null);await page.clock.fastForward(5*60*1000);await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');assert(imageCalls>=2,'published photos are picked up without reloading');assert(await page.locator('.product-image').first().getAttribute('src'));
 mode='fail';await page.clock.fastForward(61*1000);await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');assert(edgeCalls>calls);assert(backupCalls>0);assert((await page.locator('#count').innerText()).includes(String(total(live))),'backup cannot downgrade a newer visible inventory');
 await page.reload();await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');assert((await page.locator('#count').innerText()).includes(String(total(backup))),'fresh visitor gets static fallback during Worker outage');
 mode='stale';await page.reload();await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');assert((await page.locator('#count').innerText()).includes(String(total(backup))),'stale Worker falls back to a newer published snapshot');
 console.log('PASS live catalog: Cloudflare first, minute polling, new photos without reloading, dialog/price preservation, static fallback during outage and no downgrade to older snapshots.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
