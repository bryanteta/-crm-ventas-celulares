(function(root,factory){const core=factory(typeof module==='object'&&module.exports?require('./sales-core.js'):root.LunivoSalesCore);if(typeof module==='object'&&module.exports)module.exports=core;else root.LunivoCatalogIdentity=core;})(typeof window==='object'?window:globalThis,(sales)=>{
'use strict';
// Shared by the public catalog (Worker and GitHub build) and the Android app so
// both compute the same published product, ID and customization key per row.
const {suggestedPrice}=sales;
const title = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
// Devices outside the phone catalog: skipped silently instead of failing.
const NOT_LISTED=/^(?:apple\s+)?(?:ipad|airpods|macbook|imac|mac\s+mini|apple\s+(?:watch|tv|pencil)|pencil)\b|^(?:samsung\s+)?(?:galaxy\s+)?(?:tab|buds|watch|book|ring)\b|^samsung\s+watch\b|^(?:google\s+)?pixel\b|^(?:xiaomi|redmi|poco|motorola|moto|huawei|honor|oppo|vivo|realme|oneplus|infinix|tecno|zte)\b/i;
const notListed=raw=>NOT_LISTED.test(String(raw).replace(/\s+/g,' ').trim());
function unknownModel(){const error=Error('Modelo no reconocido: revisa la fuente antes de publicar.');error.code='unknown-model';return error;}
function modelName(raw) {
  const s = String(raw).replace(/\s+/g, ' ').trim().replace(/^samsung\s+galaxy\s+/i,'Samsung ').replace(/^galaxy\s+/i,'Samsung ').replace(/^apple\s+(?=iphone\b)/i,'');
  // Apple sells it as "iPhone Air"; providers also write "iPhone 17 Air".
  // Both publish under the existing name so images and adjustments still match.
  if (/^iphone\s*air(?=\s|$)/i.test(s)) return {manufacturer:'Apple', model:'iPhone 17 Air'};
  let m = s.match(/^iphone\s*(?:(\d{1,2})(e)?|(SE|XR|XS|X))(?:\s+(pro\s*max|pro|plus|mini|air|max))?(?=\s|$)/i);
  if (m && (!m[4] || !/^max$/i.test(m[4]) || /^xs$/i.test(m[3]||''))) {
    const base = m[1] ? m[1]+(m[2] ? 'e' : '') : m[3].toUpperCase();
    return {manufacturer:'Apple', model:`iPhone ${base}${m[4] ? ' '+title(m[4].replace(/pro\s*max/i,'Pro Max')) : ''}`};
  }
  m = s.match(/^samsung\s+(?:(z)\s*(fold|flip)\s*(\d{1,2})|((?:s|a|m|note)\s*\d{1,3})(?:\s*(ultra|fe|plus|edge|\+))?)(?=\s|$)/i);
  if (m) {
    const edition = !m[5] ? '' : /^fe$/i.test(m[5]) ? ' FE' : m[5]==='+' ? ' Plus' : ' '+title(m[5]);
    return {manufacturer:'Samsung', model:'Samsung '+(m[1] ? `Z ${title(m[2])} ${m[3]}` : m[4].replace(/\s/g,'').toUpperCase().replace('NOTE','Note ')+edition)};
  }
  throw unknownModel();
}
function colorName(raw) {
  const colors = {blanco:'Blanco',white:'Blanco',negro:'Negro',black:'Negro',morado:'Morado',purple:'Morado',lila:'Lila',lilac:'Lila',lavanda:'Lila',lavender:'Lila',glaciar:'Glaciar',glacier:'Glaciar',verde:'Verde',green:'Verde',dorado:'Dorado',gold:'Dorado',azul:'Azul',blue:'Azul',rojo:'Rojo',red:'Rojo',celeste:'Celeste',amarillo:'Amarillo',yellow:'Amarillo',rosado:'Rosado',pink:'Rosado',rosa:'Rosado',desert:'Titanio desierto',gris:'Gris',gray:'Gris',grey:'Gris',anaranjado:'Anaranjado',naranja:'Anaranjado',orange:'Anaranjado',silver:'Plata',plata:'Plata',burgundy:'Borgoña',natural:'Titanio natural',titanio:'Titanio natural'};
  const clean=String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/\b(?:titanio|titanium)\s*(?:gris|gray|grey)\b|\b(?:gris|gray|grey)\s*(?:titanium|titanio)\b/.test(clean))return 'Gris';
  if(/\b(?:titanio|titanium)\s*(?:negro|black)\b|\b(?:black|negro)\s*(?:titanium|titanio)\b/.test(clean))return 'Negro';
  if(/\b(?:titanio|titanium)\s*(?:desierto|desert)\b|\bdesert\s*titanium\b/.test(clean))return 'Titanio desierto';
  const words=String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]+/g)||[];
  return [...new Set(words.map(w=>colors[w]).filter(Boolean))].join(' / ') || 'Color por confirmar';
}
function conditionName(category, notes, model) {
  function classify(value) {
    if(/\bopen[ -]*box\b/i.test(value))return 'Open Box';
    if(/\b(?:seminuevo|semi[ -]nuevo|usado|como nuevo)\b/i.test(value))return 'Seminuevo';
    if(/\b(?:nuevo|sellado)\b/i.test(value))return 'Nuevo';
    return null;
  }
  return classify(category)||classify(notes)||classify(model)||'Seminuevo';
}
// Describe one validated provider row as the public catalog publishes it.
// Returns null for rows the phone catalog never lists (watches, tablets,
// accessories, other brands). Throws for rows the catalog refuses to publish;
// an unrecognized phone model throws with code 'unknown-model' so the build
// can skip that row with a visible warning instead of freezing the catalog.
function describe(provider, r) {
  if(notListed(r.model))return null;
  if (r.price<=0) throw Error('No se publican equipos sin un precio válido.');
  const device=modelName(r.model);
  if(r.color.trim()&&colorName(r.color)==='Color por confirmar')throw Error('El proveedor declara un color que el catálogo todavía no reconoce. Revisa su equivalencia antes de publicar; se conserva la lista anterior.');
  const storage=(r.capacity+' '+r.model+' '+r.notes).match(/\b(\d{2,4})\s*GB|\b([1-8])\s*TB/i);
  const shorthand=r.notes.match(/\b(64|128|256|512|1024)\s*\/\s*(?:100|[1-9]?\d)\s*%/);
  const capacity=storage ? `${storage[1]||storage[2]} ${storage[1]?'GB':'TB'}` : shorthand ? `${shorthand[1]} GB` : 'Capacidad por confirmar';
  const description=`${r.category} ${r.model} ${r.notes}`;
  const condition=conditionName(r.category,r.notes,r.model);
  const grade=/^(A\+?|B\+?)$/.test(r.category) ? r.category : '';
  const percent=(r.battery+' '+r.notes).match(/\b(100|[1-9]?\d)\s*%/);
  const battery=percent ? `${Number(percent[1])}%` : '';
  const observations=[];
  const message=/\b(msj|mensaje|aviso)\b/i.test(r.notes);
  if(message&&/\bbater[ií]a\b/i.test(r.notes))observations.push('Aviso de batería');
  if(message&&/\bpantalla\b/i.test(r.notes))observations.push('Aviso de pantalla');
  if(message&&/\bc[aá]mara\b/i.test(r.notes))observations.push('Aviso de cámara');
  if(message&&/\btruedepth\b/i.test(r.notes))observations.push('Aviso de TrueDepth');
  if(message&&/\bface\s*id\b/i.test(r.notes))observations.push('Aviso de Face ID');
  if(/\bdesgaste\b/i.test(r.notes))observations.push('Desgaste visible');
  const cyclesMatch=(r.model+' '+r.notes).match(/\b(\d{1,5})\s*(?:ciclos\b|c\b)/i);
  const cycles=cyclesMatch?Number(cyclesMatch[1]):null;
  const physical=/\b(?:sim|chip)\s*f[ií]sic[oa]\b/i.test(description);
  const esim=/\be[ -]?sim\b/i.test(description);
  const sim=physical?(esim?'SIM física y eSIM':'SIM física'):esim?'eSIM':'Por confirmar';
  const ramMatch=description.match(/\b(\d{1,2})\s*(?:GB\s*)?RAM\b/i);
  const ram=ramMatch?Number(ramMatch[1])+' GB':'';
  const box=/\bsin\s+caja\b/i.test(description)?false:/\bcaja\b/i.test(description)?true:null;
  if(/\bburbuj(?:a|as|ita|itas)\b.{0,25}\bpantalla\b/i.test(r.notes))observations.push('Burbujas en pantalla');
  if(/\bpuntos?\s+negros?\b/i.test(r.notes)&&/\bpantalla\b/i.test(r.notes))observations.push('Puntos negros en pantalla');
  if(/\bpantalla\s+(?:reemplazad[ao]|cambiad[ao])\b/i.test(r.notes))observations.push('Pantalla reemplazada');
  if(/\bincluye\b.{0,30}\bcable\b/i.test(r.notes))observations.push('Cable incluido');
  const specs={...device,capacity,color:colorName(r.color||r.notes),condition,grade,battery,observations,cycles,sim,box,ram};
  const priceCents=suggestedPrice(r.price);
  // Match the app's complete available units: never replace a different price.
  // Different source descriptions may carry details we cannot safely publish.
  // Keep those units separate rather than assuming unknown conditions match.
  const descriptionIdentity=r.notes.normalize('NFC').trim().toLocaleLowerCase('es').replace(/\s+/g,' ');
  const key=JSON.stringify({...specs,priceCents,descriptionIdentity});
  const sourceInitial=provider==='samuel'?'T':r.ownerId==='javier'?'J':'S';
  return {specs,priceCents,mergeKey:key,sourceInitial};
}
// Group rows exactly like the public catalog: units with the same merge key
// share one product and the providers that offer it. Unpublishable rows are
// reported separately so callers can decide whether to fail or skip them.
function group(entries) {
  const products=new Map(),rows=new Map(),skipped=[];
  for(const {provider,row} of entries){
    let item;try{item=describe(provider,row);}catch(error){skipped.push({provider,row,error});continue;}
    if(!item)continue;
    let product=products.get(item.mergeKey);
    if(!product){product={mergeKey:item.mergeKey,specs:item.specs,priceCents:item.priceCents,quantity:0,sourceInitials:[]};products.set(item.mergeKey,product);}
    product.quantity+=row.quantity;
    if(!product.sourceInitials.includes(item.sourceInitial)){product.sourceInitials.push(item.sourceInitial);product.sourceInitials.sort((a,b)=>'TSJ'.indexOf(a)-'TSJ'.indexOf(b));}
    if(row.id!==undefined)rows.set(row.id,product);
  }
  return {products,rows,skipped};
}
return {modelName,colorName,conditionName,describe,group,notListed};
});
