'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),manifest=require('../catalogo/product-images.json'),inventory=require('../catalogo/inventory.json');
const checked=new Set();let minimum=Infinity,maximum=0;
for(const [key,picture]of Object.entries(manifest.products)){
 const high=(picture.gallery||[]).find(p=>p.label==='Vista general en alta resolución'),general=high||picture,seen=new Set(),views=[];
 const individual=(picture.gallery||[]).filter(p=>p.singleDevice===true);
 for(const p of individual.length?individual:[general,...(picture.gallery||[]).slice(0,10)]){
  assert.equal(p.model+'|'+p.color,key,'every view belongs to the exact model/color');assert(/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(p.path),'local product asset');
  if(seen.has(p.sha256))continue;seen.add(p.sha256);views.push(p);
  if(!checked.has(p.path)){const bytes=fs.readFileSync(path.join(root,'catalogo',p.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),p.sha256,p.path);checked.add(p.path);}
  assert(p.width>0&&p.height>0);if(p.framing){const f=p.framing;assert(f.x>=0&&f.y>=0&&f.width>0&&f.height>0&&f.x+f.width<=p.width&&f.y+f.height<=p.height);}
 }
 assert(views.length>=(individual.length?2:3),key+' needs verified distinct images');
 if(picture.model.startsWith('iPhone ')){assert(individual.length,'iPhone modal requires reviewed individual photos');assert(!picture.gallery.some(p=>p.label==='Frente y reverso'||p.credit==='Apple'&&p.label==='Vista posterior'),'no redundant paired photos');}minimum=Math.min(minimum,views.length);maximum=Math.max(maximum,views.length);
}
const pending=inventory.products.filter(p=>!manifest.products[p.model+'|'+p.color]);
for(const p of pending){
 const entry=manifest.unavailable?.[p.model+'|'+p.color];
 assert(p.color==='Color por confirmar'||entry&&entry.model===p.model&&entry.color===p.color&&typeof entry.reason==='string'&&entry.reason.trim().length>0,'a missing exact-color image must have an explicit pending record: '+p.model+' | '+p.color);
}
const missing=[...new Set(pending.map(p=>p.model+' · '+p.capacity+' · '+p.color))];
console.log('PASS coverage: '+Object.keys(manifest.products).length+' known model/color galleries, '+minimum+'–'+maximum+' distinct views, valid local assets and checksums.');
if(missing.length)console.log('Exact model/color images explicitly pending: '+missing.join('; '));
