'use strict';
const {chromium}=require('playwright'),a=require('node:assert/strict');
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const [width,height]of [[320,740],[412,915],[994,1020],[915,412],[600,400]]){
  const p=await b.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('.view').first().click();await p.getByLabel('Tasa cero',{exact:false}).check();
  const geometry=()=>p.evaluate(()=>{const dialog=document.querySelector('#details').getBoundingClientRect(),menu=document.querySelector('#bank-choices').getBoundingClientRect(),button=document.querySelector('#bank-current').getBoundingClientRect();return{dialog:dialog.toJSON(),menu:menu.toJSON(),button:button.toJSON(),placement:document.querySelector('#bank-dropdown').dataset.placement};});
  const bounded=async()=>{const g=await geometry();a(g.menu.top>=g.dialog.top+8&&g.menu.bottom<=g.dialog.bottom-8,JSON.stringify({width,height,g}));a(g.menu.left>=g.dialog.left&&g.menu.right<=g.dialog.right);a(g.menu.height>=58);a(g.menu.width>150);return g;};
  for(const theme of ['light','dark']){
   await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);const before=await p.locator('#details').evaluate(e=>({height:e.getBoundingClientRect().height,price:document.querySelector('.detail-price').offsetTop}));await p.locator('#bank-current').click();a.equal(await p.locator('#bank-dropdown').evaluate(e=>e.open),true);const g=await bounded();const after=await p.locator('#details').evaluate(e=>({height:e.getBoundingClientRect().height,price:document.querySelector('.detail-price').offsetTop}));a.deepEqual(after,before,'opening does not expand the modal or move the price');if(width===412)a.equal(g.placement,'above','near the bottom the bank list must open upwards');
   if(width===412)await p.screenshot({path:'/workspace/artifacts/lunivo-bank-menu-position-'+theme+'.png'});await p.keyboard.press('Escape');a.equal(await p.locator('#bank-dropdown').evaluate(e=>e.open),false);a.equal(await p.locator('#details').isVisible(),true);
  }
  await p.locator('#bank-current').click();await p.locator('[data-bank-id=cuscatlan]').click();a.equal(await p.locator('#bank-dropdown').evaluate(e=>e.open),false);await p.locator('[name=installment-term][value="36"]').check();a.match(new URL(await p.locator('#consult').getAttribute('href')).searchParams.get('text'),/Banco Cuscatlán · 36 cuotas/);
  await p.locator('#bank-current').click();await bounded();await p.setViewportSize({width:width===320?412:320,height:640});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));if(await p.locator('#bank-dropdown').evaluate(e=>e.open))await bounded();a.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS bank menu geometry: list stays inside the dialog, flips above when needed, scrolls internally on short screens, preserves modal height/prices, Escape keeps the dialog open, resize is safe and bank/terms/WhatsApp remain correct in both themes.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
