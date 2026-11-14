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
