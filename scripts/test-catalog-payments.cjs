'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/';
const money=n=>new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(n/100);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1140,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const source=JSON.parse(fs.readFileSync('catalogo/inventory.json','utf8'));
  const config=JSON.parse(fs.readFileSync('catalogo/payment-plans.json','utf8'));
  assert.deepEqual(config.banks.map(b=>b.id),['agricola','bac','promerica','davivienda','cuscatlan']);
  const terms={agricola:[3,6,9,12],bac:[3,6,9,12],promerica:[3,6,9,12,18,24],davivienda:[3,6,9,12,18,24],cuscatlan:[3,6,9,12,18,24,36]};
  config.banks.forEach(b=>{assert.deepEqual(b.installments,terms[b.id]);assert.match(b.name,/^Banco /);});
  await page.goto(base);await page.locator('.card').first().waitFor();
  assert.match(await page.locator('.promotion-legend').textContent(),/Precio promocional al contado.*Precio regular con tasa 0/);
  const cards=await page.locator('.card').evaluateAll(cards=>cards.map(c=>({id:c.dataset.productId,promo:c.querySelector('.price').textContent,regular:c.querySelector('.regular-price s').textContent,label:c.querySelector('.from').textContent,caption:c.querySelector('.cash-only').textContent})));
  for(const card of cards){
   const product=source.products.find(p=>p.id===card.id);assert(product);
   assert.equal(card.promo,money(product.priceCents));
   assert.equal(card.regular,money(Math.floor((product.priceCents*11+500)/1000)*100));
   assert.equal(card.label,'Precio promocional');assert.equal(card.caption,'Precio exclusivo por pago de contado');
  }
  await page.locator('.view').first().click();
  const id=await page.locator('#variant').inputValue(),p=source.products.find(p=>p.id===id),regular=Math.floor((p.priceCents*11+500)/1000)*100;
  assert.equal(await page.locator('#detail-price').textContent(),money(p.priceCents));
  assert.equal(await page.locator('#detail-regular s').textContent(),money(regular));
  assert.equal(await page.locator('#financing').isVisible(),false);
  let message=decodeURIComponent(await page.locator('#consult').getAttribute('href'));
  assert(message.includes('Al contado, precio promocional: '+money(p.priceCents)));
  await page.getByLabel('Tasa cero', {exact:false}).check();
  assert.equal(await page.locator('#financing').isVisible(),true);
  assert.equal(await page.locator('#detail-price').textContent(),money(regular));
  assert.equal(await page.locator('#detail-regular').isVisible(),false);
  assert.equal(await page.locator('#installment-options').isVisible(),false);
  for(const bank of config.banks){
   await page.locator('#payment-bank').selectOption(bank.id);
   assert.equal(await page.locator('[name=installment-term]:checked').count(),0);
   assert.deepEqual(await page.locator('[name=installment-term]').evaluateAll(o=>o.map(n=>n.value)),bank.installments.map(String));
   assert.equal(await page.locator('#installment-grid label:visible').count(),bank.installments.length);assert.doesNotMatch(await page.locator('#installment-grid').textContent(),/Por mes|Última|última|aprox/i);
   for(const months of bank.installments){const card=page.locator('#installment-grid label').filter({has:page.locator('[value="'+months+'"]')});assert.equal(await card.locator('strong').textContent(),(regular%months?'Desde ':'')+money(Math.floor(regular/months)));}
   for(const months of bank.installments){
    await page.locator('[name=installment-term][value="'+months+'"]').check();
    assert.equal(await page.locator('#installment-summary').isVisible(),false);
    assert.equal(await page.locator('#detail-price').textContent(),money(regular));
    message=decodeURIComponent(await page.locator('#consult').getAttribute('href'));
    assert(message.includes('A tasa cero, precio regular: '+money(regular)));
    assert(message.includes(bank.name+' · '+months+' cuotas'));
    assert(!message.includes('Al contado'));
   }
  }
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{localStorage.setItem('lunivo-catalog-theme',t);document.documentElement.dataset.theme=t;},theme);
   for(const width of [320,412,840,1140]){
    await page.setViewportSize({width,height:915});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+theme+width);
    assert(await page.locator('#details').evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog overflow '+theme+width);
    if(width===412)await page.screenshot({path:'/workspace/artifacts/lunivo-tasa-cero-'+theme+'.png'});
   }
  }
  await page.locator('#payment-bank').selectOption('bac');assert.equal(await page.locator('[name=installment-term][value="36"]').count(),0);assert.equal(await page.locator('[name=installment-term]:checked').count(),0);
  await page.getByLabel('Al contado', {exact:false}).check();
  assert.equal(await page.locator('#financing').isVisible(),false);
  assert.equal(await page.locator('#detail-price').textContent(),money(p.priceCents));
  assert(!decodeURIComponent(await page.locator('#consult').getAttribute('href')).includes('cuotas'));
  await page.locator('#close').click();await page.locator('.view').last().click();
  assert.equal(await page.locator('[name=payment][value=cash]').isChecked(),true);
  assert.equal(await page.locator('#payment-bank').inputValue(),'');
  await page.locator('#close').click();
  await page.setViewportSize({width:1140,height:1000});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'/workspace/artifacts/lunivo-promocional-web.png'});
  await page.locator('#products').scrollIntoViewIfNeeded();await page.screenshot({path:'/workspace/artifacts/lunivo-precios-promocionales.png'});
  const rounding=await browser.newPage();
  await rounding.route('**/inventory.json',r=>r.fulfill({json:{...source,products:[{...source.products[0],priceCents:10005}]}}));
  await rounding.goto(base);await rounding.locator('.card').waitFor();
  assert.equal(await rounding.locator('.price').textContent(),'$100.05');assert.equal(await rounding.locator('.regular-price s').first().textContent(),'$110.00');
  await rounding.locator('.view').click();await rounding.getByLabel('Tasa cero',{exact:false}).check();
  await rounding.locator('#payment-bank').selectOption('bac');await rounding.locator('[name=installment-term][value="12"]').check();
  assert.equal(await rounding.locator('#installment-summary').isVisible(),false);assert.equal(await rounding.locator('#detail-price').textContent(),'$110.00');
  for(const [promo,expected] of [[93500,'$1,029.00'],[10409,'$114.00'],[10410,'$115.00']]){
   await rounding.route('**/inventory.json',r=>r.fulfill({json:{...source,products:[{...source.products[0],priceCents:promo}]}}));
   await rounding.reload();await rounding.locator('.card').waitFor();assert.equal(await rounding.locator('.regular-price s').first().textContent(),expected);
  }
  const failure=await browser.newPage();await failure.route('**/payment-plans.json',r=>r.fulfill({status:500,body:''}));
  await failure.goto(base);await failure.locator('.card').first().waitFor();await failure.locator('.view').first().click();await failure.getByLabel('Tasa cero',{exact:false}).check();
  assert.match(await failure.locator('#installment-summary').textContent(),/No se pudieron cargar/);
  assert.equal(await failure.locator('#installment-options').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS promotional cash/regular +10% for every card, five banks with specific terms up to 36 months and whole-dollar regular prices, exact total with no selected-plan breakdown, approximation or last-payment labels, WhatsApp method/bank/terms, reset between products, responsive two themes and safe config failure');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
