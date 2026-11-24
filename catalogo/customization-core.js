(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LunivoCatalogCustomizations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function specification(p){return JSON.stringify([p.manufacturer,p.model,p.capacity,p.color,p.condition,p.grade,p.battery,p.cycles??null,p.sim||'Por confirmar',p.box??null,p.ram||'',[...(p.observations||[])].sort()]);}
 function identity(p){return JSON.stringify([...JSON.parse(specification(p)),[...(p.sourceInitials||[])].sort()]);}
 async function key(p){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity(p)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);}
 function imageUrl(value){
  if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020]/.test(value))return false;
  try{const u=new URL(value),host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!/^localhost$|\.localhost$|\.local$|\.internal$|^\[|^\d+(?:\.\d+){0,3}$/.test(host);}catch{return false;}
 }
 function patch(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['priceCents','images'].includes(k)))throw Error('Edición inválida.');
  const priceCents=value.priceCents??null;
  if(priceCents!==null&&(!Number.isSafeInteger(priceCents)||priceCents<100||priceCents>10000000))throw Error('El precio debe estar entre $1.00 y $100,000.00.');
  if(!Array.isArray(value.images)||value.images.length>8)throw Error('Puedes guardar hasta ocho imágenes.');
  const seen=new Set(),images=value.images.map((art,i)=>{
   if(!art||Object.keys(art).some(k=>!['url','width','height','label'].includes(k))||!imageUrl(art.url)||!Number.isSafeInteger(art.width)||!Number.isSafeInteger(art.height)||art.width<100||art.height<100||art.width>20000||art.height>20000||seen.has(art.url))throw Error('Revisa los enlaces y las dimensiones de las imágenes.');
   if(art.label!==undefined&&(typeof art.label!=='string'||art.label.length>60))throw Error('Nombre de imagen inválido.');seen.add(art.url);
   return {url:art.url,width:art.width,height:art.height,label:art.label?.trim()||'Vista '+(i+1)};
  });
  return {priceCents,images};
 }
 function state(value){
  if(value?.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!value.overrides||typeof value.overrides!=='object'||Array.isArray(value.overrides)||Object.keys(value.overrides).length>1000||value.updatedAt!==null&&!Number.isFinite(Date.parse(value.updatedAt)))throw Error('Configuración del catálogo inválida.');
  const overrides={};for(const [id,edit]of Object.entries(value.overrides)){if(!/^[a-f0-9]{32}$/.test(id))throw Error('Dispositivo de edición inválido.');overrides[id]=patch(edit);}
  return {version:1,revision:value.revision,updatedAt:value.updatedAt,overrides};
 }
 function empty(){return {version:1,revision:0,updatedAt:null,overrides:{}};}
 function apply(p,edit){const price=p.automaticPriceCents??p.priceCents;const result={...p,priceCents:edit?.priceCents??price,automaticPriceCents:price};delete result.customImages;if(edit?.images?.length)result.customImages=edit.images.map(a=>({...a}));return result;}
 // A healthy live service is authoritative, even after its revision resets.
 // Once live data was seen, an outage cannot resurrect an older static edit.
 function chooseSnapshot(previous,published,live){
  if(live)return {state:state(live),liveSeen:true};
  if(previous?.liveSeen)return previous;
  const current=previous?.state||empty();
  return {state:published&&published.revision>=current.revision?state(published):current,liveSeen:false};
 }
 const providerNames=Object.freeze({T:'TecnoShop',S:'Split',J:'Javier'});
 function context(p){const result={};for(const field of ['manufacturer','model','capacity','color','condition','grade','battery','cycles','sim','box','ram','observations','sourceInitials'])if(p[field]!==undefined)result[field]=p[field];return JSON.parse(JSON.stringify(result));}
 function priceRanges(rows){const ranges=new Map();for(const row of rows){const price=row.product.priceCents,range=ranges.get(row.key);if(range){range.min=Math.min(range.min,price);range.max=Math.max(range.max,price);}else ranges.set(row.key,{min:price,max:price});}return ranges;}
 function backup(value){
  if(value?.format==='lunivo-catalog-backup'){
   if(value.version!==1||Object.keys(value).some(k=>!['format','version','exportedAt','customizations','adminMetadata'].includes(k)))throw Error('Respaldo inválido.');
   const metadata=value.adminMetadata||{};if(typeof metadata!=='object'||Array.isArray(metadata)||Object.keys(metadata).length>1000)throw Error('Contexto de respaldo inválido.');
   return {customizations:state(value.customizations),adminMetadata:metadata};
  }
  return {customizations:state(value),adminMetadata:{}};
 }
 return {specification,identity,key,imageUrl,patch,state,empty,apply,chooseSnapshot,providerNames,context,priceRanges,backup};
});
