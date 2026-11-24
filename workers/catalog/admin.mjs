import custom from '../../catalogo/customization-core.js';
import {INTERVAL} from './service.mjs';
const LIMIT=32768,ORIGINS=new Set(['https://lunivosv.com','https://www.lunivosv.com']);
const validKey=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
function response(data,status=200,origin=''){
 return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}:{})}});
}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('Envía los datos como JSON.'),{status:415});
 if(Number(request.headers.get('content-length'))>LIMIT)throw Object.assign(Error('La edición es demasiado grande.'),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Error('Faltan los datos.');let bytes=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>LIMIT){await reader.cancel();throw Object.assign(Error('La edición es demasiado grande.'),{status:413});}chunks.push(value);}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
export async function authorized(request,env){
 const secret=typeof env.CATALOG_ADMIN_TOKEN==='string'?env.CATALOG_ADMIN_TOKEN.trim():'';if(secret.length<32)return false;
 const header=request.headers.get('authorization')||'';if(!header.startsWith('Bearer ')||header.length>1024)return false;
 const encode=v=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));const [a,b]=await Promise.all([encode(header.slice(7)),encode(secret)]);const left=new Uint8Array(a),right=new Uint8Array(b);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
function record(store){const saved=store.read('customizations');return saved?JSON.parse(saved):custom.empty();}
export function getCustomizations(store){return custom.state(record(store));}
function metadata(value,state){const result={};for(const key of Object.keys(state.overrides))if(value.adminMetadata?.[key])result[key]=value.adminMetadata[key];return result;}
function result(state,adminMetadata,origin){return response({version:1,customizations:state,adminMetadata},200,origin);}
export async function adminRequest(request,store){
 const origin=request.headers.get('origin')||'',allowed=!origin||ORIGINS.has(origin)||origin===store.env.CATALOG_ADMIN_DEV_ORIGIN;
 if(!allowed)return response({error:'Origen no autorizado.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'https://lunivosv.com','Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});
 if(typeof store.env.CATALOG_ADMIN_TOKEN!=='string'||store.env.CATALOG_ADMIN_TOKEN.trim().length<32)return response({error:'La administración aún no está activada.'},503,origin);
 if(!await authorized(request,store.env))return response({error:'La clave no es válida.'},401,origin);
 const path=new URL(request.url).pathname;
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
  const fields=['key','productId','expectedRevision','expectedEdit','fromKey','patch'];
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||!validKey(input.key)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Datos de edición inválidos.');
  if(input.fromKey!==undefined&&(!validKey(input.fromKey)||input.fromKey===input.key||request.method!=='PUT'))throw Error('Origen de edición inválido.');
  const hasExpected=Object.hasOwn(input,'expectedEdit');
  const expected=hasExpected?(input.expectedEdit===null?null:custom.patch(input.expectedEdit)):null;
  let edit=null,product=null;
  if(request.method==='PUT'){
   if(typeof input.productId!=='string'||!/^[a-f0-9]{20}$/.test(input.productId))throw Error('Equipo inválido.');
   if(!store.latest)await store.refresh();
   if(!store.latest)return response({error:'No se pudo consultar el inventario. Intenta nuevamente.'},503,origin);
   product=JSON.parse(store.latest).products.find(p=>p.id===input.productId);
   if(!product||await custom.key(product)!==input.key)return response({error:'Este equipo cambió o ya no está disponible. Recarga la lista.'},409,origin);
   edit=custom.patch(input.patch);
  }
  // No await between conflict check and SQLite write. Older clients retain
  // global revision protection; new clients can edit independent keys safely.
  const saved=record(store),state=custom.state(saved),adminMetadata=metadata(saved,state),current=state.overrides[input.key]||null;
  if(request.method==='DELETE'&&!current)return result(state,adminMetadata,origin);
  const conflict=input.fromKey?state.revision!==input.expectedRevision:hasExpected?JSON.stringify(current)!==JSON.stringify(expected):state.revision!==input.expectedRevision;
  if(conflict)return response({error:'Hay cambios más recientes. Recarga la lista antes de guardar.'},409,origin);
  if(input.fromKey&&!state.overrides[input.fromKey])return response({error:'El ajuste que deseas reasignar ya no existe. Recarga la lista.'},409,origin);
  const removing=request.method==='DELETE'||edit.priceCents===null&&!edit.images.length;
  if(removing){delete state.overrides[input.key];delete adminMetadata[input.key];}
  else{
   state.overrides[input.key]=edit;
   adminMetadata[input.key]={product,automaticPriceCentsAtEdit:product.priceCents,savedAt:new Date().toISOString()};
  }
  if(input.fromKey){delete state.overrides[input.fromKey];delete adminMetadata[input.fromKey];}
  if(Object.keys(state.overrides).length>1000)return response({error:'Se alcanzó el límite de 1000 ajustes. Elimina ajustes sin equipo disponible antes de agregar otro.'},413,origin);
  state.revision++;state.updatedAt=new Date().toISOString();custom.state(state);
  const serialized=JSON.stringify({...state,adminMetadata});
  if(new TextEncoder().encode(serialized).length>1024*1024)return response({error:'Se alcanzó el límite de almacenamiento. Elimina ajustes sin equipo disponible o reduce las fotos guardadas.'},413,origin);
  try{store.write('customizations',serialized);}catch{return response({error:'No se pudo guardar en este momento. Intenta nuevamente.'},503,origin);}
  return result(state,adminMetadata,origin);
 }catch(error){return response({error:error.status===413?'La edición es demasiado grande.':'No se pudo guardar. Revisa los datos y vuelve a intentar.'},error.status||400,origin);}
}
