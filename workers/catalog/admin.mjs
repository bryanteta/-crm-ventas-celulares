import custom from '../../catalogo/customization-core.js';
import {INTERVAL} from './service.mjs';
const LIMIT=32768,ORIGINS=new Set(['https://lunivosv.com','https://www.lunivosv.com']);
const validKey=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
function response(data,status=200,origin=''){
 return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}:{})}});
}
async function body(request,limit=LIMIT){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('Envía los datos como JSON.'),{status:415});
 if(Number(request.headers.get('content-length'))>limit)throw Object.assign(Error('La edición es demasiado grande.'),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Error('Faltan los datos.');let bytes=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();throw Object.assign(Error('La edición es demasiado grande.'),{status:413});}chunks.push(value);}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
export async function authorized(request,env){
 const secret=typeof env.CATALOG_ADMIN_TOKEN==='string'?env.CATALOG_ADMIN_TOKEN.trim():'';if(secret.length<32)return false;
 const header=request.headers.get('authorization')||'';if(!header.startsWith('Bearer ')||header.length>1024)return false;
 const encode=v=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));const [a,b]=await Promise.all([encode(header.slice(7)),encode(secret)]);const left=new Uint8Array(a),right=new Uint8Array(b);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
function record(store){const saved=store.read('customizations');return saved?JSON.parse(saved):custom.empty();}
export function getCustomizations(store){return custom.state(record(store));}
function metadata(value,state){
 const result={};for(const key of Object.keys(state.overrides)){const saved=value.adminMetadata?.[key];if(saved)result[key]={...(saved.product?{product:custom.context(saved.product)}:{}),automaticPriceCentsAtEdit:saved.automaticPriceCentsAtEdit,...(saved.automaticPriceRangeAtEdit?{automaticPriceRangeAtEdit:saved.automaticPriceRangeAtEdit}:{}),savedAt:saved.savedAt};}return result;
}
function limitedLogin(store,request,success=false){
 const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')?.slice(0,80)||'unknown';store.failedLogins??=new Map();
 for(const [key,entry]of store.failedLogins)if(entry.until<=now)store.failedLogins.delete(key);
 if(success){store.failedLogins.delete(ip);return 0;}
 const previous=store.failedLogins.get(ip);if(previous?.count>=10)return Math.ceil((previous.until-now)/1000);
 if(!previous&&store.failedLogins.size>=1000)store.failedLogins.delete(store.failedLogins.keys().next().value);
 store.failedLogins.set(ip,{count:(previous?.count||0)+1,until:previous?.until||now+5*60*1000});return 0;
}
async function backupMetadata(snapshot){
 const result={};for(const [key,value]of Object.entries(snapshot.adminMetadata)){
  if(!snapshot.customizations.overrides[key]||!value||typeof value!=='object'||Array.isArray(value)||!value.product)throw Error('Contexto de respaldo inválido.');
  const product=custom.context(value.product);
  if(typeof product.manufacturer!=='string'||!product.manufacturer.trim()||product.manufacturer.length>80||['model','capacity','color','condition'].some(field=>typeof product[field]!=='string'||product[field].length>160)||['grade','battery','sim','ram'].some(field=>product[field]!=null&&(typeof product[field]!=='string'||product[field].length>160))||!Array.isArray(product.sourceInitials)||!product.sourceInitials.length||product.sourceInitials.length>3||product.sourceInitials.some(v=>!Object.hasOwn(custom.providerNames,v))||new Set(product.sourceInitials).size!==product.sourceInitials.length||product.observations!==undefined&&(!Array.isArray(product.observations)||product.observations.length>30||product.observations.some(v=>typeof v!=='string'||v.length>1000))||product.cycles!=null&&(!Number.isSafeInteger(product.cycles)||product.cycles<0)||product.box!=null&&typeof product.box!=='boolean'||await custom.key(product)!==key)throw Error('Equipo de respaldo inválido.');
  const range=value.automaticPriceRangeAtEdit||{min:value.automaticPriceCentsAtEdit,max:value.automaticPriceCentsAtEdit};
  if(!Number.isSafeInteger(range.min)||!Number.isSafeInteger(range.max)||range.min<100||range.max<range.min||typeof value.savedAt!=='string'||!Number.isFinite(Date.parse(value.savedAt)))throw Error('Referencia de respaldo inválida.');
  result[key]={product,automaticPriceCentsAtEdit:range.max,automaticPriceRangeAtEdit:{min:range.min,max:range.max},savedAt:value.savedAt};
 }return result;
}
function save(store,state,adminMetadata,origin){
 if(Object.keys(state.overrides).length>1000)return response({error:'Se alcanzó el límite de 1000 ajustes. Elimina ajustes sin coincidencia disponible antes de agregar otro.'},413,origin);
 state.revision++;state.updatedAt=new Date().toISOString();custom.state(state);
 const serialized=JSON.stringify({...state,adminMetadata});
 if(new TextEncoder().encode(serialized).length>1024*1024)return response({error:'Se alcanzó el límite de almacenamiento. Elimina ajustes antiguos o reduce las fotos guardadas.'},413,origin);
 try{store.write('customizations',serialized);}catch{return response({error:'No se pudo guardar en este momento. Intenta nuevamente.'},503,origin);}
 return result(state,adminMetadata,origin);
}
function result(state,adminMetadata,origin){return response({version:1,customizations:state,adminMetadata},200,origin);}
export async function adminRequest(request,store){
 const origin=request.headers.get('origin')||'',allowed=!origin||ORIGINS.has(origin)||origin===store.env.CATALOG_ADMIN_DEV_ORIGIN;
 if(!allowed)return response({error:'Origen no autorizado.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'https://lunivosv.com','Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});
 if(typeof store.env.CATALOG_ADMIN_TOKEN!=='string'||store.env.CATALOG_ADMIN_TOKEN.trim().length<32)return response({error:'La administración aún no está activada.'},503,origin);
 const validCredential=await authorized(request,store.env),retry=limitedLogin(store,request,validCredential);
 if(retry){const limited=response({error:'Demasiados intentos de acceso. Espera cinco minutos e intenta nuevamente.'},429,origin);limited.headers.set('Retry-After',String(retry));return limited;}
 if(!validCredential)return response({error:'La clave no es válida.'},401,origin);
 const path=new URL(request.url).pathname;
 if(path==='/admin/backup'&&request.method==='GET'){
  const saved=record(store),state=custom.state(saved);return response({format:'lunivo-catalog-backup',version:1,exportedAt:new Date().toISOString(),customizations:state,adminMetadata:metadata(saved,state)},200,origin);
 }
 if(path==='/admin/import'&&request.method==='PUT'){
  try{
   const input=await body(request,4*1024*1024+16384);
   if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['expectedRevision','snapshot'].includes(k))||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Importación inválida.');
   const incoming=custom.backup(input.snapshot),incomingMetadata=await backupMetadata(incoming);
   // Validation can await hashes; the revision check and write below cannot.
   const saved=record(store),state=custom.state(saved),adminMetadata=metadata(saved,state);
   if(state.revision!==input.expectedRevision)return response({error:'Hay cambios más recientes. Recarga la lista antes de restaurar el respaldo.'},409,origin);
   if(!Object.keys(incoming.customizations.overrides).length)return result(state,adminMetadata,origin);
   for(const [key,edit]of Object.entries(incoming.customizations.overrides)){state.overrides[key]=edit;if(incomingMetadata[key])adminMetadata[key]=incomingMetadata[key];else delete adminMetadata[key];}
   return save(store,state,adminMetadata,origin);
  }catch(error){return response({error:error.status===413?'El archivo de respaldo es demasiado grande.':'El respaldo no es válido. No se modificaron los ajustes.'},error.status||400,origin);}
 }
 if(path==='/admin/catalog'&&request.method==='GET'){
  if(!store.latest||Date.now()-Date.parse(JSON.parse(store.latest).updatedAt)>=INTERVAL)await store.refresh();
  if(!store.latest)return response({error:'No se pudo consultar el inventario. Intenta nuevamente.'},503,origin);
  const inventory=JSON.parse(store.latest),products=await Promise.all(inventory.products.map(async p=>({...p,customizationKey:await custom.key(p)})));
  const saved=record(store),state=custom.state(saved);
  return response({version:1,updatedAt:inventory.updatedAt,cached:Date.now()-Date.parse(inventory.updatedAt)>=INTERVAL,products,customizations:state,adminMetadata:metadata(saved,state)},200,origin);
 }
 if(path!=='/admin/customizations'||!['PUT','DELETE'].includes(request.method))return response({error:'Ruta no disponible.'},404,origin);
 try{
  const input=await body(request);
  const fields=['key','productId','expectedRevision','expectedEdit','expectedFromEdit','fromKey','patch'];
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||!validKey(input.key)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Datos de edición inválidos.');
  if(input.fromKey!==undefined&&(!validKey(input.fromKey)||input.fromKey===input.key||request.method!=='PUT'))throw Error('Origen de edición inválido.');
  const hasExpected=Object.hasOwn(input,'expectedEdit');
  const expected=hasExpected?(input.expectedEdit===null?null:custom.patch(input.expectedEdit)):null;const hasExpectedFrom=Object.hasOwn(input,'expectedFromEdit'),expectedFrom=hasExpectedFrom?custom.patch(input.expectedFromEdit):null;
  let edit=null,product=null,range=null;
  if(request.method==='PUT'){
   if(typeof input.productId!=='string'||!/^[a-f0-9]{20}$/.test(input.productId))throw Error('Equipo inválido.');
   if(!store.latest)await store.refresh();
   if(!store.latest)return response({error:'No se pudo consultar el inventario. Intenta nuevamente.'},503,origin);
   const products=JSON.parse(store.latest).products;product=products.find(p=>p.id===input.productId);
   if(!product||await custom.key(product)!==input.key)return response({error:'Este equipo cambió o ya no está disponible. Recarga la lista.'},409,origin);
   edit=custom.patch(input.patch);const keyed=await Promise.all(products.map(async p=>({key:await custom.key(p),product:p})));range=custom.priceRanges(keyed).get(input.key);
  }
  // No await between conflict check and SQLite write. Older clients retain
  // global revision protection; new clients can edit independent keys safely.
  const saved=record(store),state=custom.state(saved),adminMetadata=metadata(saved,state),current=state.overrides[input.key]||null;
  if(request.method==='DELETE'&&!current)return result(state,adminMetadata,origin);
  const conflict=input.fromKey?(hasExpected&&hasExpectedFrom?JSON.stringify(current)!==JSON.stringify(expected)||JSON.stringify(state.overrides[input.fromKey]||null)!==JSON.stringify(expectedFrom):state.revision!==input.expectedRevision):hasExpected?JSON.stringify(current)!==JSON.stringify(expected):state.revision!==input.expectedRevision;
  if(conflict)return response({error:'Hay cambios más recientes. Recarga la lista antes de guardar.'},409,origin);
  if(input.fromKey&&!state.overrides[input.fromKey])return response({error:'El ajuste que deseas reasignar ya no existe. Recarga la lista.'},409,origin);
  const removing=request.method==='DELETE'||edit.priceCents===null&&!edit.images.length;
  if(removing){delete state.overrides[input.key];delete adminMetadata[input.key];}
  else{
   state.overrides[input.key]=edit;
   adminMetadata[input.key]={product:custom.context(product),automaticPriceCentsAtEdit:range.max,automaticPriceRangeAtEdit:range,savedAt:new Date().toISOString()};
  }
  if(input.fromKey){delete state.overrides[input.fromKey];delete adminMetadata[input.fromKey];}
  return save(store,state,adminMetadata,origin);
 }catch(error){return response({error:error.status===413?'La edición es demasiado grande.':'No se pudo guardar. Revisa los datos y vuelve a intentar.'},error.status||400,origin);}
}
