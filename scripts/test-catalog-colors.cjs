'use strict';
const {chromium}=require('playwright'),a=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const chooseBank=(page,id)=>page.locator('#bank-choices [data-bank-id="'+id+'"]').click();
const base=process.env.CATALOG_TEST_URL||'http://127.0.0.1:8000/catalogo/',source=JSON.parse(fs.readFileSync('catalogo/inventory.json'));
  const model={...source.products.find(p=>p.model==='iPhone 13'),manufacturer:'Apple',model:'iPhone 13',capacity:'128 GB',color:'Negro',condition:'Seminuevo',grade:'A',battery:'100%',priceCents:43000,quantity:2,cycles:null,sim:'Por confirmar',box:null,ram:'',observations:[]};
  let id=0;const item=extra=>({...model,...extra,id:(++id).toString(16).padStart(20,'0')});
  const black=item({}),red=item({color:'Rojo',quantity:3}),blue=item({color:'Azul',quantity:1});
  const products=[black,red,blue,...[{capacity:'256 GB'},{battery:'99%'},{grade:'B'},{priceCents:44000},{box:true},{observations:['Aviso de pantalla']},{cycles:20}].map(v=>item({...v,color:'Rojo',quantity:1})),item({quantity:1})];
  const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/inventory.json',r=>r.fulfill({json:{...source,updatedAt:new Date().toISOString(),products}}));
  await p.goto(base);await p.locator('.card').first().waitFor();
  a.equal(await p.locator('.card').count(),9,'only equivalent color variants share a card; duplicate color alternatives remain separate');
  a.equal(await p.locator('#products .color-swatch').count(),11,'every source variant remains reachable');
  a.match(await p.locator('#count').textContent(),/14 equipos/);
  const card=()=>p.locator('#products .card').filter({has:p.locator(`[data-variant-id="${blue.id}"]`)});
  a.equal(await card().locator('.color-swatch').count(),3);await card().getByRole('button',{name:'Rojo',exact:true}).click();
  a.equal(await card().getAttribute('data-product-id'),red.id);a.match(await card().locator('.summary').textContent(),/Rojo/);a.match(await card().locator('img').getAttribute('src'),/red|rojo/);a.equal(await card().locator('.availability').textContent(),'3 disponibles');
  await card().getByRole('button',{name:'Azul',exact:true}).focus();await p.keyboard.press('Space');a.equal(await card().getAttribute('data-product-id'),blue.id);a.equal(await card().getByRole('button',{name:'Azul',exact:true}).getAttribute('aria-pressed'),'true');
  await card().locator('.view').click();a.equal(await p.locator('#variant').inputValue(),blue.id);a.match(new URL(await p.locator('#consult').getAttribute('href')).searchParams.get('text'),/Color Azul/);
  await p.getByLabel('Tasa cero',{exact:false}).check();await chooseBank(p,'cuscatlan');await p.locator('[name=installment-term][value="36"]').check();
  await p.locator('#detail-colors').getByRole('button',{name:'Rojo',exact:true}).click();a.equal(await p.locator('#variant').inputValue(),red.id);a.equal(await p.locator('#payment-bank').inputValue(),'cuscatlan');a.equal(await p.locator('[name=installment-term][value="36"]').isChecked(),true);const message=new URL(await p.locator('#consult').getAttribute('href')).searchParams.get('text');a.match(message,/Color Rojo/);a.match(message,/36 cuotas/);a.equal(await card().getAttribute('data-product-id'),red.id);
  await p.locator('#close').click();await p.locator('#search').fill('Azul');a.equal(await p.locator('.card').count(),1);a.equal(await p.locator('#products .color-swatch').count(),1);a.match(await p.locator('.summary').textContent(),/Azul/);a.match(await p.locator('#count').textContent(),/1 equipo/);await p.locator('#search').fill('');
  for(const theme of ['light','dark'])for(const width of [320,412,1280]){
   await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.setViewportSize({width,height:915});a(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.locator('#inventario').scrollIntoViewIfNeeded();if(width===412)await p.screenshot({path:'/workspace/artifacts/lunivo-colores-'+theme+'.png'});
  }
  a.deepEqual(errors,[]);console.log('PASS color grouping: all variants and stock preserved, differing specifications separate, exact photo/color availability, keyboard selection, detail/payment/WhatsApp consistency, color search, light/dark and three widths.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
