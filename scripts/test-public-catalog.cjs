'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/';
 const data=JSON.parse(fs.readFileSync('catalogo/inventory.json','utf8'));
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(base);await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
 const selectedHero=await page.locator('.hero-pick:not([hidden])').evaluateAll(cards=>cards.map(c=>({id:c.dataset.productId,src:c.querySelector('img').getAttribute('src'),alt:c.querySelector('img').alt})));
 const heroImages=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8')).products;
 assert.equal(selectedHero.length,2);
 for(const selected of selectedHero){const item=data.products.find(p=>p.id===selected.id);assert(item&&item.available);assert.equal(selected.src,heroImages[item.model+'|'+item.color].path);assert(selected.alt.includes(item.color));}
 await page.locator('.hero-primary').click();assert.equal(new URL(page.url()).hash,'#inventario');
 assert((await page.locator('.hero-advice').getAttribute('href')).startsWith('https://wa.me/50376241930'));
 const count=await page.locator('.card').count();assert(count>10);
 assert.equal(count,data.products.length);
 const rendered=await page.locator('.card').evaluateAll(cards=>cards.map(c=>c.dataset.productId));
 assert.deepEqual([...rendered].sort(),data.products.map(p=>p.id).sort());
 const imageMap=JSON.parse(fs.readFileSync('catalogo/product-images.json','utf8'));
 assert(data.products.every(p=>imageMap.products[p.model+'|'+p.color]||imageMap.unavailable[p.model+'|'+p.color]),'Every variant has an exact color image or an explicit pending entry');
 const assigned=await page.locator('.card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.productId,src:c.querySelector('img').getAttribute('src'),alt:c.querySelector('img').alt,pending:c.querySelector('.image-placeholder').textContent})));
 for(const card of assigned){const p=data.products.find(p=>p.id===card.id),image=imageMap.products[p.model+'|'+p.color];if(image){assert.equal(card.src,image.path);assert(card.alt.includes(p.color));}else{assert.equal(card.src,null);assert(card.pending.includes('color pendiente'));}}
 assert.equal(await page.getByText('Estado por confirmar',{exact:false}).count(),0);
 await page.locator('.product-image').first().evaluate(img=>img.decode());
 assert(await page.locator('.product-image').first().evaluate(img=>img.naturalWidth>0));
 for(const width of [320,412,1140]){await page.setViewportSize({width,height:915});assert(await page.locator('.card .photo-crop:has(img[src])').evaluateAll(frames=>frames.every(frame=>{const p=frame.parentElement.getBoundingClientRect(),r=frame.getBoundingClientRect();return Math.abs(r.left+r.width/2-p.left-p.width/2)<1&&Math.abs(r.top+r.height/2-p.top-p.height/2)<1&&r.width>0&&r.height>0;})));}
 await page.setViewportSize({width:1280,height:900});
 assert.equal(await page.getByText('Batería por confirmar',{exact:false}).count(),0);
 const withoutBattery=data.products.find(p=>!p.battery);if(withoutBattery){const card=page.locator(`[data-product-id="${withoutBattery.id}"]`);assert((await card.locator('.variant-specs').textContent()).includes('Batería en excelente estado'));await card.locator('.view').click();assert((await page.locator('#specs').textContent()).includes('En excelente estado'));await page.locator('#close').click();}
 assert.equal(await page.locator('#error').isVisible(),false);
 assert((await page.locator('#count').textContent()).includes(String(data.products.reduce((n,p)=>n+p.quantity,0))));
 await page.getByRole('button',{name:'Samsung',exact:true}).click();
 assert((await page.locator('.card h3').allTextContents()).every(s=>s.startsWith('Samsung')));
 await page.getByRole('button',{name:'iPhone',exact:true}).click();
 assert((await page.locator('.card h3').allTextContents()).every(s=>s.startsWith('iPhone')));
 await page.locator('#capacity').selectOption('128 GB');
 assert((await page.locator('.card .summary').allTextContents()).every(s=>s.includes('128 GB')));
 await page.locator('#search').fill('iPhone 13 Pro');
 assert(await page.locator('.card').count()>0);
 await page.locator('.view').first().click();
 assert(await page.locator('#details').isVisible());
 const selected=await page.locator('#variant').inputValue();
 const item=data.products.find(p=>p.id===selected);assert(item);
 assert((await page.locator('#specs').textContent()).includes(String(item.quantity)));
 const href=await page.locator('#consult').getAttribute('href');assert(href.startsWith('https://wa.me/50376241930?text='));
 assert(decodeURIComponent(href).includes(item.model));assert(decodeURIComponent(href).includes((item.priceCents/100).toFixed(2)));
 const options=await page.locator('#variant option').evaluateAll(o=>o.map(n=>n.value));
 if(options.length>1){await page.locator('#variant').selectOption(options[options.length-1]);const price=data.products.find(p=>p.id===options[options.length-1]).priceCents;assert((await page.locator('#detail-price').textContent()).includes((price/100).toFixed(2)));}
 await page.keyboard.press('Escape');assert.equal(await page.locator('#details').isVisible(),false);
 await page.locator('#search').fill('noexistezz');assert(await page.locator('#empty').isVisible());
 await page.locator('#reset').click();assert.equal(await page.locator('.card').count(),count);
 await page.locator('#sort').selectOption('low');
 const prices=await page.locator('.card .price').allTextContents();const nums=prices.map(s=>Number(s.replace(/[^\d.]/g,'')));assert.deepEqual(nums,[...nums].sort((a,b)=>a-b));
 await page.locator('#sort').selectOption('model');
 fs.mkdirSync('/workspace/artifacts',{recursive:true});
 await page.screenshot({path:'/workspace/artifacts/lunivo-catalogo-escritorio.png'});
 for(const width of [320,412,840]){
  await page.setViewportSize({width,height:915});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
  assert(await page.locator('.hero-primary').isVisible());
  const layout=await page.locator('.hero-primary').evaluate(el=>{const a=el.getBoundingClientRect(),h=document.querySelector('.hero').getBoundingClientRect();return a.left>=h.left&&a.right<=h.right;});assert(layout,`Hero action clipped at ${width}`);
  await page.locator('.view').first().click();
  assert(await page.evaluate(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  if(width===412)await page.screenshot({path:'/workspace/artifacts/lunivo-catalogo-detalle.png'});
  await page.locator('#close').click();
  if(width===412)await page.screenshot({path:'/workspace/artifacts/lunivo-catalogo-movil.png'});
 }
 assert.deepEqual(errors,[]);
 assert(requests.every(url=>url.startsWith(base)),`Unexpected network request: ${requests.filter(url=>!url.startsWith(base))}`);
 const lilac=await browser.newPage({viewport:{width:412,height:915}});
 await lilac.goto(base);await lilac.locator('.card').first().waitFor();await lilac.locator('#search').fill('iPhone 14 Plus');
 const lilacItem=data.products.find(p=>p.model==='iPhone 14 Plus'&&p.color==='Lila');
 if(lilacItem){const card=lilac.locator(`[data-product-id="${lilacItem.id}"]`);assert((await card.locator('.summary').textContent()).includes('Lila'));assert((await card.locator('.variant-specs').textContent()).includes(lilacItem.battery));assert((await card.locator('img').getAttribute('src')).includes('lila'));await lilac.locator('#inventario').scrollIntoViewIfNeeded();await card.locator('img').evaluate(i=>i.decode());await lilac.screenshot({path:'/workspace/artifacts/lunivo-14-plus-lila-corregido.png'});}
 const flips=await browser.newPage({viewport:{width:412,height:915}});
 await flips.goto(base);await flips.locator('.card').first().waitFor();await flips.locator('#search').fill('Flip 4');
 const flipItems=data.products.filter(p=>p.model==='Samsung Z Flip 4');
 for(const item of flipItems){const card=flips.locator(`[data-product-id="${item.id}"]`);assert((await card.locator('.summary').textContent()).includes(item.color));await card.locator('img').evaluate(i=>i.decode());assert.equal(await card.locator('img').getAttribute('src'),imageMap.products[item.model+'|'+item.color].path);assert.equal(await card.locator('.image-placeholder').isVisible(),false);}
 if(flipItems.length){await flips.locator('#inventario').scrollIntoViewIfNeeded();await flips.screenshot({path:'/workspace/artifacts/lunivo-flip4-blanco-amarillo.png'});}
 const bad=await browser.newPage();
 await bad.route('**/inventory.json',r=>r.fulfill({status:500,body:'error'}));
 await bad.goto(base);await bad.locator('#error').waitFor();
 await bad.unroute('**/inventory.json');await bad.locator('#retry').click();await bad.locator('.card').first().waitFor();
 const missingImage=await browser.newPage();
 await missingImage.route('**/assets/products/**',r=>r.abort());
 await missingImage.goto(base);await missingImage.locator('.card').first().waitFor();
 await missingImage.waitForFunction(()=>!document.querySelector('.card .image-placeholder').hidden);
 assert.equal(await missingImage.locator('.card').count(),data.products.length);
 await missingImage.locator('#hero-signature').waitFor();assert(await missingImage.locator('#hero-signature').isVisible());
 const noStock=await browser.newPage();await noStock.route('**/inventory.json',r=>r.fulfill({json:{...data,products:[]}}));await noStock.goto(base);await noStock.locator('#empty').waitFor();assert.equal(await noStock.locator('.hero-pick:visible').count(),0);assert(await noStock.locator('#hero-signature').isVisible());
 const stale=await browser.newPage();
 await stale.route('**/inventory.json',r=>r.fulfill({json:{...data,updatedAt:'2020-01-01T00:00:00Z'}}));
 await stale.goto(base);await stale.locator('#notice').waitFor();assert((await stale.locator('.availability').first().textContent()).includes('Consultar'));
 const malicious=await browser.newPage();
 await malicious.route('**/inventory.json',r=>r.fulfill({json:{...data,products:[{...data.products[0],model:'<img src=x onerror=alert(1)>'}]}}));
 await malicious.goto(base);await malicious.locator('.card').waitFor();assert.equal(await malicious.locator('.card h3 img').count(),0);
 const auto=await browser.newPage();
 await auto.clock.install({time:new Date()});
 let calls=0,fail=false;
 await auto.route('**/inventory.json',async r=>{calls++;if(fail)return r.fulfill({status:503,body:'temporary failure'});return r.fulfill({json:{...data,updatedAt:new Date().toISOString()}});});
 await auto.goto(base);await auto.locator('.card').first().waitFor();
 await auto.getByRole('button',{name:'Samsung',exact:true}).click();await auto.locator('#capacity').selectOption('128 GB');
 const filtered=await auto.locator('.card h3').allTextContents();
 await auto.locator('.view').first().click();const chosen=await auto.locator('#variant').inputValue(),shownPrice=await auto.locator('#detail-price').textContent(),before=calls;
 await auto.clock.fastForward(5*60*1000);assert.equal(calls,before);assert.equal(await auto.locator('#variant').inputValue(),chosen);assert.equal(await auto.locator('#detail-price').textContent(),shownPrice);
 await auto.locator('#close').click();await auto.clock.fastForward(5*60*1000);await auto.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
 assert(calls>before);assert.deepEqual(await auto.locator('.card h3').allTextContents(),filtered);assert.equal(await auto.locator('#capacity').inputValue(),'128 GB');
 fail=true;await auto.clock.fastForward(5*60*1000);await auto.locator('#notice').waitFor();assert.deepEqual(await auto.locator('.card h3').allTextContents(),filtered);
 assert((await auto.locator('#notice').textContent()).includes('lista anterior'));
 await browser.close();console.log('Public catalog: separate variant cards, official images, image fallback, filters, prices, contact, responsive layouts, privacy of requests, retry, stale, automatic refresh, dialog preservation, offline fallback and text safety passed.');
})().catch(e=>{console.error(e);process.exit(1);});
