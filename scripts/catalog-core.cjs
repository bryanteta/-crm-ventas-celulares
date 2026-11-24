'use strict';
const {createHash}=require('node:crypto');
const {validate}=require('../feeds-core.js');
const catalogIdentity=require('../catalog-identity.js');
const {modelName,colorName,conditionName}=catalogIdentity;
function buildCatalog(snapshot, now=Date.now(), previous=null) {
  const checked=Date.parse(snapshot?.checkedAt);
  if (snapshot?.version!==1 || !Number.isFinite(checked) || checked>now+300000 || now-checked>24*60*60*1000) throw Error('Usa una captura completa de las últimas 24 horas.');
  const products=new Map();
  for (const provider of ['samuel','split']) {
    const source=validate(provider,snapshot.providers?.[provider]);
    for (const r of source.rows) {
      const item=catalogIdentity.describe(provider,r);
      if(!item)continue;
      const {specs,priceCents,mergeKey:key,sourceInitial}=item;
      const existing=products.get(key);
      if(existing){existing.quantity+=r.quantity;if(!existing.sourceInitials.includes(sourceInitial)){existing.sourceInitials.push(sourceInitial);existing.sourceInitials.sort((a,b)=>'TSJ'.indexOf(a)-'TSJ'.indexOf(b));}}
      else products.set(key,{id:createHash('sha256').update(key).digest('hex').slice(0,20),...specs,priceCents,quantity:r.quantity,available:true,sourceInitials:[sourceInitial]});
    }
  }
  if(previous?.schemaVersion===1&&Array.isArray(previous.products)){
    const known=new Map(previous.products.map(p=>[p.id,p]));
    const identity=p=>JSON.stringify([p.manufacturer,p.model,p.capacity,p.color,p.condition,p.grade,p.battery,p.cycles??null,p.sim,p.box??null,p.ram||'',p.observations]);
    const variants=new Map(previous.products.map(p=>[identity(p),p]));
    for(const p of products.values()){
      const old=known.get(p.id)||variants.get(identity(p)),date=old?.addedAt;
      if(Number.isFinite(Date.parse(date))&&Date.parse(date)<=checked)p.addedAt=date;
      else if(!old)p.addedAt=new Date(checked).toISOString();
    }
  }
  return {schemaVersion:1,brand:'Lunivo',currency:'USD',updatedAt:new Date(checked).toISOString(),products:[...products.values()].sort((a,b)=>a.model.localeCompare(b.model,'es',{numeric:true})||a.priceCents-b.priceCents)};
}
module.exports={buildCatalog,modelName,colorName,conditionName};
