'use strict';
const {chromium,webkit,devices}=require('playwright'),a=require('node:assert/strict');
const plans=require('../catalogo/payment-plans.json');
const engine=process.env.CATALOG_BROWSER==='webkit'?webkit:chromium;
(async()=>{const browser=await engine.launch(engine===chromium?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{});try{
 for(const [width,height] of [[320,740],[390,844],[430,932],[844,390]]){
  const page=await browser.newPage({...devices['iPhone 13'],viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.goto(process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/');await page.locator('.card').first().waitFor();
  a.equal(await page.locator('#headline').innerText(),'Recíbelo\nRevísalo\nPaga');
  a(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width<721){a(await page.evaluate(()=>{const text=document.querySelector('#headline').getBoundingClientRect(),art=document.querySelector('.hero-collection').getBoundingClientRect();return art.left>=text.right&&Math.min(text.bottom,art.bottom)>Math.max(text.top,art.top)}),'phones sit alongside the steps');}
  for(const id of ['capacity','sort'])a.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).fontSize),'16px');
  await page.locator('#capacity').selectOption('128 GB');a((await page.locator('.card .summary').allTextContents()).every(t=>t.includes('128 GB')));
  await page.locator('#sort').selectOption('high');const prices=await page.locator('.card .price').allTextContents();const values=prices.map(p=>Number(p.replace(/[^\d.]/g,'')));a(values.every((v,i)=>!i||values[i-1]>=v));
  await page.getByRole('button',{name:'Samsung',exact:true}).tap();a((await page.locator('.card h3').allTextContents()).every(t=>t.startsWith('Samsung')));
  await page.getByRole('button',{name:'Todos',exact:true}).tap();await page.locator('#capacity').selectOption('all');await page.locator('#sort').selectOption('model');
  await page.locator('#search').fill('iPhone 13');a(await page.locator('.card').count()>0);await page.locator('#search').fill('');await page.locator('#search').blur();
  await page.locator('.product-name').first().tap();a(await page.locator('#details').isVisible());await page.locator('#close').tap();await page.locator('.product-photo').first().tap();
  await page.getByLabel('Tasa cero',{exact:false}).check();const select=page.locator('#payment-bank');a(await select.isVisible());a.equal(await select.getAttribute('aria-hidden'),'false');
  await select.scrollIntoViewIfNeeded();a(await select.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e}),'native select owns the touch target');
  await select.tap();
  for(const bank of plans.banks){await select.selectOption(bank.id);a.equal(await page.locator('#bank-dropdown').evaluate(e=>e.open),false);a.equal(await page.locator('#bank-current-content').innerText(),bank.name);a.deepEqual(await page.locator('[name=installment-term]').evaluateAll(es=>es.map(e=>Number(e.value))),bank.installments);
   const term=bank.installments.at(-1);await page.locator('[name=installment-term][value="'+term+'"]').check();const url=new URL(await page.locator('#consult').getAttribute('href'));a.equal(url.hostname,'api.whatsapp.com');a(url.searchParams.get('text').includes(bank.name+' · '+term+' cuotas'));
  }
  await page.getByLabel('Al contado',{exact:false}).check();a.equal(await page.locator('#financing').isVisible(),false);await page.locator('#close').tap();
  await page.locator('#theme-toggle').tap();a.equal(await page.locator('html').getAttribute('data-theme'),'dark');for(const id of ['capacity','sort'])a.notEqual(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundImage),'none');a(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.hero-primary').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished)));await page.evaluate(()=>scrollTo(0,0));if(width===390)await page.screenshot({path:'/workspace/artifacts/lunivo-mobile-'+engine.name()+'.png'});
  a.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS '+engine.name()+': touch filters, search, sorting, product image/name, native bank picker, all banks/terms, WhatsApp message, cash switch, close, theme and responsive header.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
