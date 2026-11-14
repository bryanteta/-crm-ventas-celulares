'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const origin='https://lunivosv.com';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function signature(p){return createHash('sha256').update(JSON.stringify([p.manufacturer,p.model,p.capacity,p.color,p.condition,p.grade,p.battery,p.cycles??null,p.sim||'Por confirmar',p.box??null,p.ram||'',[...p.observations].sort()])).digest('hex').slice(0,24);}
function prepareSharePages(source,output){
 const inventory=JSON.parse(fs.readFileSync(path.join(source,'inventory.json'),'utf8'));
 const images=JSON.parse(fs.readFileSync(path.join(source,'product-images.json'),'utf8')).products;
 const manifest={version:1,products:{}};
 const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:cents%100?2:0}).format(cents/100);
 for(const p of inventory.products){
  if(!/^[a-f0-9]{20}$/.test(p.id))throw Error('Invalid public product ID');
  const route='/equipo/'+p.id+'/',sig=signature(p),url=origin+route;
  const title=`${p.model} ${p.capacity} · ${money(p.priceCents)} · LUNIVO`;
  const description=[p.condition,p.color,p.grade?'Categoría '+p.grade:'',p.manufacturer==='Samsung'?'Batería en excelentes condiciones':p.battery?'Batería '+p.battery:'',...p.observations].filter(Boolean).join(' · ')+'. Precio promocional al contado. Consulta disponibilidad y condiciones de compra.';
  const picture=images[p.model+'|'+p.color];
  const exact=picture&&/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(picture.path);
  const image=origin+'/'+(exact?picture.path:'assets/logo.png');
  const target='/?'+new URLSearchParams({equipo:p.id,version:sig});
  const folder=path.join(output,'equipo',p.id);fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="Lunivo"><meta property="og:locale" content="es_SV"><meta property="og:url" content="${escape(url)}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${escape(image)}"><meta property="og:image:secure_url" content="${escape(image)}"><meta property="og:image:alt" content="${escape(exact?p.model+' '+p.color+' · imagen de referencia':'Lunivo · foto de este color pendiente')}">
${exact?`<meta property="og:image:width" content="${Number(picture.width)}"><meta property="og:image:height" content="${Number(picture.height)}">`:''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}">
<script>location.replace(${JSON.stringify(target)});</script></head>
<body><main><h1>${escape(title)}</h1><img src="${escape(image)}" alt="${escape(p.model+' · '+p.color)}" width="400" style="max-width:100%;height:auto"><p>${escape(description)}</p><a href="${escape(target)}">Ver este dispositivo en Lunivo</a></main></body></html>\n`);
  manifest.products[p.id]={path:route,signature:sig};
 }
 fs.writeFileSync(path.join(output,'share-pages.json'),JSON.stringify(manifest));
 // Removed devices still reach the catalog's unavailable message instead of a dead page.
 fs.writeFileSync(path.join(output,'404.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Lunivo</title><script>const match=location.pathname.match(/^\\/equipo\\/([a-f0-9]{20})\\/?$/);if(match){const params=new URLSearchParams(location.search);params.set('equipo',match[1]);location.replace('/?'+params);}</script></head><body><p>Este enlace ya no está disponible.</p><a href="/">Explorar el catálogo de Lunivo</a></body></html>\n`);
 return manifest;
}
module.exports={prepareSharePages,signature};
