'use strict';
// Add standalone search pages without changing the existing catalog or share pages.
const fs=require('node:fs'),path=require('node:path');
const origin='https://lunivosv.com';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const slug=model=>model.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\+/g,'-plus').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const money=cents=>new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(cents/100);
const regular=cents=>Number((BigInt(cents)*11n+500n)/1000n)*100;
const organization={'@type':'Organization','@id':origin+'/#organization',name:'Lunivo',url:origin+'/',logo:origin+'/assets/logo.png',sameAs:['https://www.instagram.com/lunivosv/','https://linktr.ee/lunivosv'],areaServed:{'@type':'Country',name:'El Salvador'}};
function photo(images,p){if(p.customImages?.length){const a=p.customImages[0];return {path:a.url,width:a.width,height:a.height,custom:true};}const art=images[p.model+'|'+p.color];return art&&/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(art.path)?art:null;}
function breadcrumbs(items){return {'@type':'BreadcrumbList',itemListElement:items.map(([name,url],i)=>({'@type':'ListItem',position:i+1,name,item:origin+url}))};}
function render({title,description,route,content,graph,image}){
 const url=origin+route,poster=image||origin+'/assets/logo.png';
 return `<!doctype html><html lang="es-SV"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f7fb">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Lunivo"><meta property="og:locale" content="es_SV"><meta property="og:url" content="${url}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${escape(poster)}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo.png"><script src="/theme.js?v=20261109-sin-aviso-antiguedad"></script><link rel="stylesheet" href="/styles.css?v=20261115-auto-photos"><link rel="stylesheet" href="/theme.css?v=20261109-sin-aviso-antiguedad"><link rel="stylesheet" href="/seo.css?v=20261116-seo">
<script type="application/ld+json">${json({'@context':'https://schema.org','@graph':[organization,...graph]})}</script></head>
<body class="model-page"><header class="header"><a class="brand" href="/" aria-label="Lunivo, inicio"><img src="/assets/logo.png" alt="" width="44" height="44"><span>LUNIVO</span></a><a class="button" href="/#inventario">Ver catálogo</a></header><main class="model-main">${content}</main><footer class="model-footer"><a href="/">Lunivo</a> · <a href="/modelos/">Todos los modelos</a><p>Precios en USD. Precio promocional exclusivo al contado. Disponibilidad, características, accesorios y condiciones de entrega sujetos a confirmación antes de comprar. Las imágenes son de referencia del modelo y color.</p></footer></body></html>\n`;
}
function prepareSeo(source,output){
 const inventory=require('./catalog-customizations.cjs').readCatalog(source),images=JSON.parse(fs.readFileSync(path.join(source,'product-images.json'),'utf8')).products;
 const grouped=new Map(),collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
 for(const p of inventory.products){
  if(!/^[a-f0-9]{20}$/.test(p.id))throw Error('Invalid public product ID');
  if(!grouped.has(p.model))grouped.set(p.model,[]);grouped.get(p.model).push(p);
 }
 const models=[...grouped.keys()].sort(collator.compare),paths=models.map(slug),urls=[origin+'/',origin+'/modelos/'];
 if(paths.some(p=>!p)||new Set(paths).size!==paths.length)throw Error('Model URLs must be nonempty and unique.');
 function write(route,html){const directory=path.join(output,route);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'index.html'),html);}
 for(const model of models){
  const products=grouped.get(model),route='/modelos/'+slug(model)+'/',url=origin+route;
  const description=`Consulta ${model} en Lunivo: capacidades, colores, estado y precios en dólares. Precio promocional al contado. Disponibilidad en El Salvador.`;
  const variants=products.map(p=>{
   const art=photo(images,p),image=art?(art.custom?art.path:origin+'/'+art.path):null,target='/equipo/'+p.id+'/',details=[p.condition,p.grade?'Categoría '+p.grade:'',p.manufacturer==='Samsung'?'Batería en excelentes condiciones':p.battery?'Batería '+p.battery:'',...p.observations].filter(Boolean).join(' · ');
   const schema={'@type':'Product','@id':url+'#equipo-'+p.id,url:url+'#equipo-'+p.id,name:[model,p.capacity,p.color].join(' · '),description:details,sku:p.id,color:p.color,size:p.capacity,brand:{'@type':'Brand',name:p.manufacturer},...(image?{image:[image]}:{}),offers:{'@type':'Offer',url:url+'#equipo-'+p.id,price:(p.priceCents/100).toFixed(2),priceCurrency:'USD',availability:'https://schema.org/InStock',itemCondition:p.condition==='Nuevo'?'https://schema.org/NewCondition':'https://schema.org/UsedCondition',seller:{'@id':origin+'/#organization'}}};
   const caption=['Imagen de referencia',p.color,...(p.sourceInitials||[])].join(' · ');
   const html=`<article class="model-card" id="equipo-${p.id}"><a class="model-photo" href="${target}" aria-label="Ver ${escape(schema.name)}">${image?`<img referrerpolicy="no-referrer" src="${escape(art.custom?art.path:'/'+art.path)}" alt="${escape(model+' · '+p.color+' · imagen de referencia')}" width="${Number(art.width)}" height="${Number(art.height)}" loading="lazy"><span>${escape(caption)}</span>`:'<span>Foto de este color pendiente</span>'}</a><div class="model-card-body"><h2>${escape(p.capacity+' · '+p.color)}</h2><p>${escape(details)}</p><div class="model-prices"><span>Precio regular <s>${money(regular(p.priceCents))}</s></span><span>Precio promocional al contado</span><strong>${money(p.priceCents)}</strong></div><a class="button" href="${target}">Ver equipo</a></div></article>`;
   return {schema,html};
  });
  write(route,render({title:model+' en El Salvador | Lunivo',description,route,image:variants[0]?.schema.image?.[0],graph:[breadcrumbs([['Lunivo','/'],['Modelos','/modelos/'],[model,route]]),{'@type':'ProductGroup','@id':url+'#modelo',url,name:model,description,productGroupID:slug(model),brand:{'@type':'Brand',name:products[0].manufacturer},variesBy:['https://schema.org/color','https://schema.org/size'],hasVariant:variants.map(v=>v.schema)}],content:`<nav class="model-breadcrumbs" aria-label="Ruta de navegación"><a href="/">Lunivo</a> / <a href="/modelos/">Modelos</a> / <span>${escape(model)}</span></nav><h1>${escape(model)} en El Salvador</h1><p class="model-intro">Explora las capacidades, colores y condiciones disponibles de ${escape(model)}. El precio promocional aplica al contado; consulta el precio regular y las opciones a tasa cero al ver cada equipo.</p><section class="model-grid" aria-label="Opciones de ${escape(model)}">${variants.map(v=>v.html).join('')}</section>`}));
  urls.push(url);
 }
 const sections=['Apple','Samsung'].map(brand=>{const names=models.filter(model=>grouped.get(model)[0].manufacturer===brand);return names.length?`<section><h2>${brand==='Apple'?'iPhone':'Samsung'}</h2><ul class="model-links">${names.map(model=>`<li><a href="/modelos/${slug(model)}/">${escape(model)}</a></li>`).join('')}</ul></section>`:'';}).join('');
 write('/modelos/',render({title:'Modelos de iPhone y Samsung | Lunivo El Salvador',description:'Explora los modelos de iPhone y Samsung disponibles en Lunivo, El Salvador. Consulta colores, capacidades, características y precios en dólares.',route:'/modelos/',graph:[breadcrumbs([['Lunivo','/'],['Modelos','/modelos/']]),{'@type':'ItemList',name:'Modelos disponibles en Lunivo',itemListElement:models.map((model,i)=>({'@type':'ListItem',position:i+1,name:model,url:origin+'/modelos/'+slug(model)+'/'}))}],content:`<nav class="model-breadcrumbs" aria-label="Ruta de navegación"><a href="/">Lunivo</a> / <span>Modelos</span></nav><h1>Modelos de iPhone y Samsung</h1><p class="model-intro">Encuentra tu próximo celular en Lunivo, El Salvador. Elige un modelo para consultar sus capacidades, colores, condiciones y precios disponibles.</p>${sections||'<p>Consulta el catálogo para conocer las próximas opciones disponibles.</p>'}`}));
 fs.writeFileSync(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(url=>'  <url><loc>'+escape(url)+'</loc></url>').join('\n')+'\n</urlset>\n');
 fs.writeFileSync(path.join(output,'robots.txt'),'User-agent: *\nAllow: /\n\nSitemap: '+origin+'/sitemap.xml\n');
 return {models:models.length,urls};
}
module.exports={prepareSeo,slug};
