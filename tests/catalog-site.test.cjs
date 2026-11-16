'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),script=path.join(root,'scripts/prepare-catalog-site.cjs');
test('Pages artifact serves the same public catalog at root and legacy path without CRM or private configuration',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-site-test-'));
 try{
  const output=path.join(tmp,'site'),built=spawnSync(process.execPath,[script,output],{encoding:'utf8'});
  assert.equal(built.status,0,built.stderr);
  for(const file of ['index.html','inventory.json','inventory-source.json','payment-plans.json','product-images.json','catalog.js','styles.css']){
   const original=fs.readFileSync(path.join(root,'catalogo',file));
   assert.deepEqual(fs.readFileSync(path.join(output,file)),original);
   if(file!=='index.html')assert.deepEqual(fs.readFileSync(path.join(output,'catalogo',file)),original);
  }
  for(const excluded of ['android','app.js','app.css','suite.js','firestore.rules','.git','.github','docs','workers'])assert.equal(fs.existsSync(path.join(output,excluded)),false);
  assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/id="products"/);
  assert.match(fs.readFileSync(path.join(output,'catalogo','index.html'),'utf8'),/location\.replace\('\.\.\/'/);
  assert.ok(fs.existsSync(path.join(output,'assets/logo.png')));
  assert.ok(fs.existsSync(path.join(output,'.nojekyll')));
  const inventory=JSON.parse(fs.readFileSync(path.join(root,'catalogo/inventory.json'))),previews=JSON.parse(fs.readFileSync(path.join(output,'share-pages.json')));
  assert.equal(Object.keys(previews.products).length,inventory.products.length);
  for(const product of inventory.products){
   const entry=previews.products[product.id];assert.equal(entry.path,'/equipo/'+product.id+'/');
   const page=fs.readFileSync(path.join(output,entry.path,'index.html'),'utf8');
   assert.match(page,/<meta property="og:title" content="[^"\n]+LUNIVO">/);
   assert.match(page,/<meta property="og:image" content="https:\/\/lunivosv\.com\/assets\//);
   assert(page.includes('Precio promocional al contado.'));
   assert(page.includes('equipo='+product.id+'&version='+entry.signature));
   assert(!page.includes('http-equiv="refresh"'),'crawlers must read product metadata before any browser redirect');
  }
  assert(fs.readFileSync(path.join(output,'404.html'),'utf8').includes("params.set('equipo',match[1])"));
  // The original page and every existing runtime file must remain byte-for-byte identical.
  for(const file of ['index.html','catalog.js','gallery.js','styles.css','hero.css','theme.css','theme.js','payment-plans.json','inventory-source.json']){
   assert.deepEqual(fs.readFileSync(path.join(output,file)),fs.readFileSync(path.join(root,'catalogo',file)),file+' unchanged');
  }
  const robots=fs.readFileSync(path.join(output,'robots.txt'),'utf8'),sitemap=fs.readFileSync(path.join(output,'sitemap.xml'),'utf8');
  assert(robots.includes('User-agent: *'));assert(robots.includes('Allow: /'));assert(robots.includes('Sitemap: https://lunivosv.com/sitemap.xml'));
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.equal(urls.length,new Set(inventory.products.map(p=>p.model)).size+2);assert.equal(new Set(urls).size,urls.length);
  assert(urls.includes('https://lunivosv.com/'));assert(urls.includes('https://lunivosv.com/modelos/'));
  assert(urls.every(url=>!/[?#]/.test(url)&&!url.includes('/equipo/')&&!url.includes('/catalogo/')));
  const variants=[];
  for(const url of urls.filter(url=>url!=='https://lunivosv.com/')){
   const html=fs.readFileSync(path.join(output,new URL(url).pathname,'index.html'),'utf8');
   assert(html.includes('<link rel="canonical" href="'+url+'">'));assert(html.includes('name="robots" content="index,follow,max-image-preview:large"'));
   assert(!html.includes('location.replace('),'model search pages display actual inventory without redirects');
   for(const script of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)){
    const graph=JSON.parse(script[1])['@graph'];for(const item of graph){if(item['@type']==='ProductGroup')variants.push(...item.hasVariant);}
   }
  }
  assert.equal(variants.length,inventory.products.length);
  for(const variant of variants){const device=inventory.products.find(p=>p.id===variant.sku);assert(device);assert.equal(variant.offers.price,(device.priceCents/100).toFixed(2));assert.equal(variant.offers.priceCurrency,'USD');assert.equal(variant.color,device.color);assert.equal(variant.size,device.capacity);}
  fs.writeFileSync(path.join(output,'keep.txt'),'preserve');
  const duplicate=spawnSync(process.execPath,[script,output],{encoding:'utf8'});
  assert.notEqual(duplicate.status,0);assert.equal(fs.readFileSync(path.join(output,'keep.txt'),'utf8'),'preserve');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('Share previews escape public text and reject external image paths',()=>{
 const {prepareSharePages,signature}=require('../scripts/catalog-share-pages.cjs');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-preview-test-'));
 try{
  const source=path.join(tmp,'source'),output=path.join(tmp,'output');fs.mkdirSync(source);fs.mkdirSync(output);
  const product={...require('../catalogo/inventory.json').products[0],model:'Phone <script>alert(1)</script>',color:'" onload="alert(2)',observations:[]};
  fs.writeFileSync(path.join(source,'inventory.json'),JSON.stringify({products:[product]}));
  fs.writeFileSync(path.join(source,'product-images.json'),JSON.stringify({products:{[product.model+'|'+product.color]:{path:'https://other.example/track.png'}}}));
  const manifest=prepareSharePages(source,output),html=fs.readFileSync(path.join(output,manifest.products[product.id].path,'index.html'),'utf8');
  assert(!html.includes('<script>alert(1)</script>'));assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('other.example'));assert(html.includes('https://lunivosv.com/assets/logo.png'));
  assert.equal(signature(product),signature({...product,id:'other',quantity:50,priceCents:product.priceCents+1000}));
  assert.notEqual(signature(product),signature({...product,color:'Otro'}));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
