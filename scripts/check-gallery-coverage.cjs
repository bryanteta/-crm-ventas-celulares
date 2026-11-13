'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=require('../catalogo/product-images.json'),inventory=require('../catalogo/inventory.json');
const checked=new Set();let minimum=Infinity,maximum=0;
for(const [key,picture]of Object.entries(manifest.products)){
 const high=(picture.gallery||[]).find(p=>p.label==='Vista general en alta resolución'),general=high||picture,seen=new Set(),views=[];
 for(const p of [general,...(picture.gallery||[]).slice(0,10)]){
  assert.equal(p.model+'|'+p.color,key,'every view belongs to the exact model/color');assert(/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(p.path),'local product asset');
  if(seen.has(p.sha256))continue;seen.add(p.sha256);views.push(p);
  if(!checked.has(p.path)){const bytes=fs.readFileSync(path.join(root,'catalogo',p.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256,p.path);checked.add(p.path);}
  assert(p.width>0&&p.height>0);if(p.framing){const f=p.framing;assert(f.x>=0&&f.y>=0&&f.width>0&&f.height>0&&f.x+f.width<=p.width&&f.y+f.height<=p.height);}
 }
 assert(views.length>=3,key+' needs at least 3 real distinct images');minimum=Math.min(minimum,views.length);maximum=Math.max(maximum,views.length);
}
const missing=[...new Set(inventory.products.filter(p=>!manifest.products[p.model+'|'+p.color]).map(p=>p.model+' · '+p.capacity+' · '+p.color))];
assert(missing.every(p=>p.endsWith('Color por confirmar')),'a known catalog color must have a gallery');
console.log('PASS coverage: '+Object.keys(manifest.products).length+' known model/color galleries, '+minimum+'–'+maximum+' distinct views, valid local assets and checksums.');
if(missing.length)console.log('Provider color still required: '+missing.join('; '));
