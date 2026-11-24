'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),custom=require('../catalogo/customization-core.js'),{key}=require('../scripts/catalog-customizations.cjs');
const p={id:'a'.repeat(20),manufacturer:'Apple',model:'iPhone 13',capacity:'128 GB',color:'Negro',condition:'Seminuevo',grade:'A',battery:'100%',priceCents:43000,quantity:1,observations:[],sourceInitials:['T']};
test('customization identity survives price/stock/IDs and keeps distinct colors, conditions and providers separate',async()=>{
 const id=await custom.key(p);assert.equal(id,key(p));assert.equal(await custom.key({...p,id:'b'.repeat(20),quantity:5,priceCents:45000}),id);
 for(const patch of [{color:'Blanco'},{capacity:'256 GB'},{grade:'B'},{sourceInitials:['J']}])assert.notEqual(await custom.key({...p,...patch}),id);
});
test('manual prices are final retail values; removing an edit restores the real automatic price',()=>{
 const edit=custom.patch({priceCents:49900,images:[{url:'https://images.example.com/a.jpg',width:600,height:800}]}),result=custom.apply(p,edit);assert.equal(result.priceCents,49900);assert.equal(result.quantity,1);assert.equal(p.priceCents,43000);assert.equal(custom.apply(result,null).priceCents,43000);assert(!custom.apply(result,null).customImages);result.customImages[0].width=1;assert.equal(edit.images[0].width,600);
});
test('public snapshots reject secrets, unknown fields, malformed keys and non-image link schemes',()=>{
 for(const url of ['javascript:alert(1)','http://example.com/a.jpg','data:image/png,a','https://localhost/a.jpg','https://169.254.169.254/a.jpg','https://user:pw@example.com/a.jpg'])assert.equal(custom.imageUrl(url),false);
 assert.throws(()=>custom.patch({priceCents:10000,images:[],secret:'private'}));assert.throws(()=>custom.state({version:1,revision:0,updatedAt:null,overrides:{bad:{priceCents:null,images:[]}}}));assert.deepEqual(custom.state(custom.empty()),custom.empty());
});
test('shared previews and model pages use saved retail prices and public image links without changing source stock',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-custom-seo-'));
 try{const source=path.join(tmp,'source'),out=path.join(tmp,'out');fs.mkdirSync(source);fs.mkdirSync(out);const file=path.join(source,'inventory.json');const original=JSON.stringify({schemaVersion:1,brand:'Lunivo',currency:'USD',updatedAt:new Date().toISOString(),products:[p]});fs.writeFileSync(file,original);fs.writeFileSync(path.join(source,'product-images.json'),JSON.stringify({version:2,products:{}}));const state=custom.empty();state.revision=1;state.updatedAt=new Date().toISOString();state.overrides[key(p)]={priceCents:55599,images:[{url:'https://images.example.com/phone.jpg',width:600,height:800,label:'Frente'}]};fs.writeFileSync(path.join(source,'customizations.json'),JSON.stringify(state));require('../scripts/catalog-share-pages.cjs').prepareSharePages(source,out);require('../scripts/catalog-seo.cjs').prepareSeo(source,out);const shared=fs.readFileSync(path.join(out,'equipo',p.id,'index.html'),'utf8'),model=fs.readFileSync(path.join(out,'modelos/iphone-13/index.html'),'utf8');assert(shared.includes('$555.99'));assert(shared.includes('https://images.example.com/phone.jpg'));assert(model.includes('"price":"555.99"'));assert(model.includes('src="https://images.example.com/phone.jpg"'));assert.equal(fs.readFileSync(file,'utf8'),original);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
