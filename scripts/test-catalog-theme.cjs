'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({colorScheme:'light',viewport:{width:1140,height:1000}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('.card').first().waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.getByRole('button',{name:'Activar modo oscuro',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('lunivo-catalog-theme')),'dark');
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#0c1220');
 await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.locator('.card').first().waitFor();
 await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(12, 18, 32)');
 assert.equal(await page.locator('.brand img').evaluate(el=>getComputedStyle(el).mixBlendMode),'normal');
 assert.equal(await page.locator('.product-image').first().evaluate(el=>getComputedStyle(el).filter),'none');
 const contrast=async selector=>page.locator(selector).first().evaluate(el=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;},lum=c=>.2126*linear(c[0])+.7152*linear(c[1])+.0722*linear(c[2]);
  let parent=el,bg='rgba(0, 0, 0, 0)';while(parent&&bg==='rgba(0, 0, 0, 0)'){bg=getComputedStyle(parent).backgroundColor;parent=parent.parentElement;}
  const a=lum(rgb(getComputedStyle(el).color)),b=lum(rgb(bg));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
 for(const selector of ['.hero-primary','.view','.brands button[aria-pressed="true"]','.contact','.theme-toggle'])assert(await contrast(selector)>=4.5,'Insufficient contrast: '+selector);
 fs.mkdirSync('/workspace/artifacts',{recursive:true});
 await page.locator('.hero-pick:not([hidden]) img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 await page.screenshot({path:'/workspace/artifacts/lunivo-modo-oscuro-escritorio.png'});
 for(const width of [320,412,840]){
  await page.setViewportSize({width,height:915});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
  assert(await page.locator('.header-actions').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),'Header controls overflow '+width);
  if(width===412)await page.screenshot({path:'/workspace/artifacts/lunivo-modo-oscuro-movil.png'});
 }
 await page.locator('.view').first().click();assert.equal(await page.locator('#details').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(21, 30, 48)');assert(await contrast('#consult')>=4.5);
 await page.screenshot({path:'/workspace/artifacts/lunivo-modo-oscuro-detalles.png'});await page.locator('#close').click();
 const other=await context.newPage();await other.goto(base);assert.equal(await other.locator('html').getAttribute('data-theme'),'dark');await other.getByRole('button',{name:'Activar modo claro',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await other.reload();assert.equal(await other.locator('html').getAttribute('data-theme'),'light');
 const system=await browser.newContext({colorScheme:'dark'}),systemPage=await system.newPage();await systemPage.goto(base);assert.equal(await systemPage.locator('html').getAttribute('data-theme'),'dark');await systemPage.emulateMedia({colorScheme:'light'});await systemPage.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await systemPage.emulateMedia({colorScheme:'dark'});await systemPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await systemPage.getByRole('button',{name:'Activar modo claro',exact:true}).click();await systemPage.emulateMedia({colorScheme:'light'});await systemPage.emulateMedia({colorScheme:'dark'});assert.equal(await systemPage.locator('html').getAttribute('data-theme'),'light');
 const blocked=await browser.newContext({colorScheme:'dark'});await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage blocked')};Storage.prototype.setItem=()=>{throw Error('Storage blocked')};});const blockedPage=await blocked.newPage();blockedPage.on('pageerror',e=>errors.push(e.message));await blockedPage.goto(base);await blockedPage.locator('.card').first().waitFor();await blockedPage.getByRole('button',{name:'Activar modo claro',exact:true}).click();assert.equal(await blockedPage.locator('html').getAttribute('data-theme'),'light');
 assert.deepEqual(errors,[]);await browser.close();console.log('Theme: manual/system preference, reload, cross-tab changes, contrast, dark dialog, mobile header and blocked storage passed.');
})().catch(e=>{console.error(e);process.exit(1);});
