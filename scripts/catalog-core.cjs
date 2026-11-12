'use strict';
const {createHash}=require('node:crypto');
const {validate}=require('../feeds-core.js');
const {suggestedPrice}=require('../sales-core.js');
const title = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
function modelName(raw) {
  const s = String(raw).replace(/\s+/g, ' ').trim();
  let m = s.match(/^iphone\s*(\d{1,2}|SE)(?:\s+(pro\s*max|pro|plus|mini|air))?(?=\s|$)/i);
  if (m) return {manufacturer:'Apple', model:`iPhone ${m[1].toUpperCase()}${m[2] ? ' '+title(m[2].replace(/pro\s*max/i,'Pro Max')) : ''}`};
  m = s.match(/^samsung\s+(?:(z)\s*(fold|flip)\s*(\d{1,2})|((?:s|a|m|note)\s*\d{1,3})(?:\s*(ultra|fe|plus|\+))?)(?=\s|$)/i);
  if (m) return {manufacturer:'Samsung', model:'Samsung '+(m[1] ? `Z ${title(m[2])} ${m[3]}` : m[4].replace(/\s/g,'').toUpperCase().replace('NOTE','Note ')+(m[5] ? ' '+(m[5].toLowerCase()==='fe'?'FE':title(m[5])) : ''))};
  throw Error('Modelo no reconocido: revisa la fuente antes de publicar.');
}
function colorName(raw) {
  const colors = {blanco:'Blanco',white:'Blanco',negro:'Negro',black:'Negro',morado:'Morado',purple:'Morado',lila:'Lila',lilac:'Lila',lavanda:'Lila',lavender:'Lila',glaciar:'Glaciar',glacier:'Glaciar',verde:'Verde',green:'Verde',dorado:'Dorado',gold:'Dorado',azul:'Azul',blue:'Azul',rojo:'Rojo',red:'Rojo',celeste:'Celeste',amarillo:'Amarillo',yellow:'Amarillo',rosado:'Rosado',pink:'Rosado',rosa:'Rosado',desert:'Titanio desierto',gris:'Gris',gray:'Gris',grey:'Gris',anaranjado:'Anaranjado',orange:'Anaranjado',silver:'Plata',plata:'Plata',burgundy:'Borgoña',natural:'Titanio natural',titanio:'Titanio natural'};
  const clean=String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
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
function buildCatalog(snapshot, now=Date.now()) {
  const checked=Date.parse(snapshot?.checkedAt);
  if (snapshot?.version!==1 || !Number.isFinite(checked) || checked>now+300000 || now-checked>24*60*60*1000) throw Error('Usa una captura completa de las últimas 24 horas.');
  const products=new Map();
  for (const provider of ['samuel','split']) {
    const source=validate(provider,snapshot.providers?.[provider]);
    for (const r of source.rows) {
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
      const existing=products.get(key);
      if(existing) existing.quantity+=r.quantity;
      else products.set(key,{id:createHash('sha256').update(key).digest('hex').slice(0,20),...specs,priceCents,quantity:r.quantity,available:true});
    }
  }
  return {schemaVersion:1,brand:'Lunivo',currency:'USD',updatedAt:new Date(checked).toISOString(),products:[...products.values()].sort((a,b)=>a.model.localeCompare(b.model,'es',{numeric:true})||a.priceCents-b.priceCents)};
}
module.exports={buildCatalog,modelName,colorName,conditionName};
