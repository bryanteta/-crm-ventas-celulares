(function(root,factory){const core=factory(typeof module==='object'&&module.exports?require('./device-core.js'):root.LunivoDevices);if(typeof module==='object'&&module.exports)module.exports=core;else root.LunivoFeedCore=core;})(typeof window==='object'?window:globalThis,(devices)=>{
'use strict';
const normalize=s=>String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const text=(v,max=1000)=>{if(typeof v!=='string'||v.length>max)throw Error('El inventario contiene un campo inválido.');return v.trim();};
function cents(v){const raw=String(v).trim().replace(/^\$\s*/,'');if(!/^(?:\d{1,9}|\d{1,3}(?:,\d{3}){1,2})(?:\.\d{1,2})?$/.test(raw))throw Error('El inventario contiene un precio inválido.');const[a,b='']=raw.replace(/,/g,'').split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
function hash(s){let a=2166136261,b=3335557771;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b^s.charCodeAt(i),2246822519);}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function csv(input){
 if(typeof input!=='string'||input.length>4*1024*1024)throw Error('La hoja de Samuel es demasiado grande o no es válida.');
 const rows=[];let row=[],field='',quoted=false,closed=false;input=input.replace(/^\uFEFF/,'');
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('CSV inválido.');quoted=true;continue;}
  if(c===','||c==='\r'||c==='\n'){row.push(field);field='';closed=false;if(c!==','){rows.push(row);row=[];if(c==='\r'&&input[i+1]==='\n')i++;}continue;}
  if(closed&&c!==' '&&c!=='\t')throw Error('CSV inválido.');if(!closed)field+=c;
 }
 if(quoted)throw Error('La hoja está incompleta.');if(field||row.length||closed){row.push(field);rows.push(row);}if(rows.length>10010)throw Error('Demasiados equipos.');return rows;
}
function group(provider,items){const groups=new Map(),ids=new Map();for(const item of items){const key=JSON.stringify([item.ownerId||'',item.model,item.capacity,item.color,item.category,item.battery,item.notes,item.price]);let entry=groups.get(key);if(!entry){const id='feed-'+provider+':'+hash(key);if(ids.has(id)&&ids.get(id)!==key)throw Error('No se pudo identificar una variante.');ids.set(id,key);entry={...item,id,supplier:provider==='samuel'?'Samuel':'Split',feedProvider:provider,source:'feed',quantity:0};groups.set(key,entry);}entry.quantity++;}return[...groups.values()];}
function samuel(input){
 const rows=csv(input),header=rows.findIndex(r=>normalize(r[0])==='modelo'&&normalize(r[1])==='color'&&normalize(r[7])==='disponibilidad');
 if(header<0||normalize(rows[header][5])!=='categoria'||!['','precio','precio usd'].includes(normalize(rows[header][6])))throw Error('La hoja de Samuel cambió de formato. Se conserva la lista anterior.');
 const items=[];let declared=null;for(const r of rows.slice(0,header))if(normalize(r[0]).includes('inventario para reventa')&&/^\d+$/.test(r[9]||''))declared=Number(r[9]);
 let recognized=0;for(const r of rows.slice(header+1)){if(!r.slice(0,9).some(v=>String(v||'').trim()))continue;const model=text(r[0]||'',200);if(!model)throw Error('Hay un equipo sin modelo en la hoja.');recognized++;const state=normalize(r[7]);if(!['disponible','apartado','vendido','agotado','no disponible'].includes(state))throw Error('Hay un estado desconocido en la hoja.');const price=cents(r[6]);if(state!=='disponible'||devices.isWearable(model))continue;items.push({model,color:text(r[1]||'',80),capacity:text(r[4]||r[2]||'',40),battery:text(r[3]||'',80),category:text(r[5]||'',80),notes:text(r[8]||''),price});}
 if(declared!==null&&declared!==recognized)throw Error('La hoja llegó incompleta. Se conserva la lista anterior.');
 return{rows:group('samuel',items),total:items.length};
}
function samuelApi(input){
 let data;
 try{
  data=typeof input==='string'?JSON.parse(input):input;
  if(data&&typeof data.c==='string')data=JSON.parse(data.c);
 }catch{throw Error('La API de Samuel no devolvió un inventario válido.');}
 if(!data||!Array.isArray(data.columnas)||data.columnas.length<7||data.columnas.length>100||!Array.isArray(data.filas)||data.filas.length>10000||!Number.isSafeInteger(data.ahora)||!Number.isSafeInteger(data.leido)||data.ahora<=0||data.leido<=0||data.leido>data.ahora+300000||!Number.isFinite(new Date(data.ahora).getTime())||!Number.isFinite(new Date(data.leido).getTime()))throw Error('La API de Samuel está incompleta. Se conserva la lista anterior.');
 const columns=data.columnas.map(c=>normalize(text(c,100)));
 const required=['modelo','color','capacidad','bateria','categoria','precio venta','observaciones'];
 if(new Set(columns).size!==columns.length||required.some(c=>!columns.includes(c)))throw Error('La API de Samuel cambió de formato. Se conserva la lista anterior.');
 const index=Object.fromEntries(required.map(c=>[c,columns.indexOf(c)])),items=[];
 for(const row of data.filas){
  if(!Array.isArray(row)||row.length!==columns.length)throw Error('La API de Samuel contiene una fila incompleta.');
  const field=(name,max)=>text(row[index[name]],max);
  const model=field('modelo',200);if(!model)throw Error('La API de Samuel contiene un equipo sin modelo.');if(devices.isWearable(model))continue;
  items.push({model,color:field('color',80),capacity:field('capacidad',40),battery:field('bateria',80),category:field('categoria',80),notes:field('observaciones',1000),price:cents(row[index['precio venta']])});
 }
 return{rows:group('samuel',items),total:items.length,sourceUpdatedAt:new Date(data.leido).toISOString()};
}
function split(input){
 let data;try{data=typeof input==='string'?JSON.parse(input):input;}catch{throw Error('Split no devolvió un inventario válido.');}
 if(!data||data.moneda!=='USD'||!Array.isArray(data.items)||!Number.isInteger(data.total)||data.total!==data.items.length||data.items.length>10000||typeof data.actualizado!=='string'||!Number.isFinite(Date.parse(data.actualizado)))throw Error('La respuesta de Split está incompleta. Se conserva la lista anterior.');
 const ids=new Set(),items=[];for(const r of data.items){if(!r||!['SPLIT','JAVIER'].includes(r.origen)||!['string','number'].includes(typeof r.id)||!String(r.id)||String(r.id).length>200)throw Error('Split contiene un equipo no reconocido.');const id=r.origen+':'+r.id;if(ids.has(id))throw Error('Split devolvió equipos duplicados.');ids.add(id);const model=text(r.modelo,200);if(!model)throw Error('Split contiene un equipo sin modelo.');if(devices.isWearable(model))continue;const detail=text(r.detalle||''),capacity=detail.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0]||model.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0]||'';items.push({model,capacity,color:text(r.color||'',80),battery:'',category:'',notes:detail,price:cents(r.precio),ownerId:r.origen==='SPLIT'?'saul':'javier'});}
 return{rows:group('split',items),total:items.length,sourceUpdatedAt:new Date(data.actualizado).toISOString()};
}
function validate(provider,result){
 if(!['samuel','split'].includes(provider)||!result||!Array.isArray(result.rows)||result.rows.length>10000||!Number.isSafeInteger(result.total)||result.total<0)throw Error('Inventario inválido.');
 const ids=new Set();let count=0;for(const r of result.rows){if(!r||typeof r.id!=='string'||!r.id.startsWith('feed-'+provider+':')||ids.has(r.id)||r.feedProvider!==provider||r.source!=='feed'||r.supplier!==(provider==='samuel'?'Samuel':'Split')||!r.model||!Number.isInteger(r.quantity)||r.quantity<1||!Number.isSafeInteger(r.price)||r.price<0||provider==='split'&&!['saul','javier'].includes(r.ownerId)||provider==='samuel'&&r.ownerId)throw Error('Una variante del inventario no es válida.');for(const field of['model','color','capacity','battery','category','notes'])text(r[field]);ids.add(r.id);count+=r.quantity;}
 if(count!==result.total)throw Error('Las unidades del inventario no coinciden.');return result;
}
function replace(data,provider,result,checkedAt,origin='network'){
 validate(provider,result);if(!Number.isFinite(Date.parse(checkedAt)))throw Error('Fecha del inventario inválida.');const date=new Date(checkedAt).toISOString().slice(0,10);
 const rows=result.rows.filter(r=>!devices.isWearable(r)).map(r=>({...r,date}));return{...data,offers:[...data.offers.filter(o=>o.feedProvider!==provider&&!(provider==='samuel'&&o.source==='pdf'&&String(o.id).startsWith('tecno-reference-'))),...rows],providerFeeds:{...data.providerFeeds,[provider]:{checkedAt:new Date(checkedAt).toISOString(),sourceUpdatedAt:result.sourceUpdatedAt||null,total:rows.reduce((n,r)=>n+r.quantity,0),variants:rows.length,origin}}};
}
return{csv,samuel,samuelApi,split,replace,validate};
});
