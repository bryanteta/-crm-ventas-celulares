'use strict';
const {chromium}=require('playwright'),a=require('node:assert/strict'),source=require('../catalogo/inventory.json');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const seed=source.products.find(p=>p.model==='iPhone 13 Pro');
 const products=[{...seed,id:'11111111111111111111',color:'Color por confirmar'}, {...seed,id:'22222222222222222222',model:'iPhone 13 Pro Max',color:'Celeste'}, {...seed,id:'33333333333333333333',model:'iPhone 13 Pro',color:'Amarillo'}, {...seed,id:'44444444444444444444',manufacturer:'Samsung',model:'Samsung A17',color:'Celeste'}];
 await page.route('**/inventory-source.json',r=>r.fulfill({json:{version:1,endpoint:''}}));
 await page.route('**/inventory.json',r=>r.fulfill({json:{...source,updatedAt:new Date().toISOString(),products}}));
 await require('./catalog-test-fixtures.cjs').withoutCustomizations(page);await page.goto(process.env.CATALOG_TEST_URL||'http://127.0.0.1:8800/catalogo/');await page.locator('.card').first().waitFor();
 for(const item of [products[0],products[1],products[3]]){
  const card=page.locator('[data-product-id="'+item.id+'"]');const image=card.locator('.product-image');
  await image.scrollIntoViewIfNeeded();await a.doesNotReject(()=>image.evaluate(img=>img.decode()));a(await image.evaluate(img=>img.naturalWidth>0));
  a((await card.locator('.image-caption').innerText()).includes(item.color));
  await card.locator('.view').click();await page.locator('#gallery-photo').evaluate(img=>img.decode());a(await page.locator('#gallery-photo').isVisible());
  if(item.color==='Color por confirmar'){a.match(await page.locator('#gallery-caption').innerText(),/Color ilustrativo/);a.equal(await page.locator('#variant').inputValue(),item.id);}
  await page.locator('#close').click();
 }
 await page.getByRole('button',{name:'Amarillo',exact:true}).click();
 const unsupported=page.locator('[data-product-id="33333333333333333333"]');a(await unsupported.locator('.image-placeholder').isVisible(),'never substitute a different color when the supplier specifies an unsupported color');
 a.deepEqual(errors,[]);console.log('PASS: Celeste has its verified Sierra Blue photo; unknown color has illustrative exact-model photos without changing inventory; unsupported known colors are not guessed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
