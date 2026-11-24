import custom from '../../catalogo/customization-core.js';
const LIMIT=32768,ORIGINS=new Set(['https://lunivosv.com','https://www.lunivosv.com']);
function response(data,status=200,origin=''){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}:{})}});}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('Envía los datos como JSON.'),{status:415});
 if(Number(request.headers.get('content-length'))>LIMIT)throw Object.assign(Error('La edición es demasiado grande.'),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Error('Faltan los datos.');let bytes=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>LIMIT){await reader.cancel();throw Object.assign(Error('La edición es demasiado grande.'),{status:413});}chunks.push(value);}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
export async function authorized(request,env){
 const secret=typeof env.CATALOG_ADMIN_TOKEN==='string'?env.CATALOG_ADMIN_TOKEN.trim():'';if(typeof secret!=='string'||secret.length<32)return false;
 const header=request.headers.get('authorization')||'';if(!header.startsWith('Bearer ')||header.length>1024)return false;
 const encode=v=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));const [a,b]=await Promise.all([encode(header.slice(7)),encode(secret)]);const left=new Uint8Array(a),right=new Uint8Array(b);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
export function getCustomizations(store){const saved=store.read('customizations');return saved?custom.state(JSON.parse(saved)):custom.empty();}
export async function adminRequest(request,store){
 const origin=request.headers.get('origin')||'',allowed=!origin||ORIGINS.has(origin)||origin===store.env.CATALOG_ADMIN_DEV_ORIGIN;
 if(!allowed)return response({error:'Origen no autorizado.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'https://lunivosv.com','Access-Control-Allow-Methods':'GET, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}});
 if(typeof store.env.CATALOG_ADMIN_TOKEN!=='string'||store.env.CATALOG_ADMIN_TOKEN.trim().length<32)return response({error:'La administración aún no está activada.'},503,origin);
 if(!await authorized(request,store.env))return response({error:'La clave no es válida.'},401,origin);
 const path=new URL(request.url).pathname;
 if(path==='/admin/catalog'&&request.method==='GET'){
  if(!store.latest)await store.refresh();if(!store.latest)return response({error:'No se pudo consultar el inventario. Intenta nuevamente.'},503,origin);
  const inventory=JSON.parse(store.latest),products=await Promise.all(inventory.products.map(async p=>({...p,customizationKey:await custom.key(p)})));
  return response({version:1,products,customizations:getCustomizations(store)},200,origin);
 }
 if(path!=='/admin/customizations'||!['PUT','DELETE'].includes(request.method))return response({error:'Ruta no disponible.'},404,origin);
 try{
  const input=await body(request);
  if(!input||Object.keys(input).some(k=>!['key','productId','expectedRevision','patch'].includes(k))||!/^[a-f0-9]{32}$/.test(input.key)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Datos de edición inválidos.');
  let edit=null;
  if(request.method==='PUT'){
   if(!/^[a-f0-9]{20}$/.test(input.productId))throw Error('Equipo inválido.');
   const product=store.latest?JSON.parse(store.latest).products.find(p=>p.id===input.productId):null;
   if(!product||await custom.key(product)!==input.key)return response({error:'Este equipo cambió o ya no está disponible. Recarga la lista.'},409,origin);
   edit=custom.patch(input.patch);
  }
  // No await between revision check and the single SQLite write: concurrent
  // editors cannot silently overwrite one another's changes.
  const state=getCustomizations(store);
  if(state.revision!==input.expectedRevision)return response({error:'Hay cambios más recientes. Recarga la lista antes de guardar.'},409,origin);
  if(request.method==='DELETE')delete state.overrides[input.key];
  else if(edit.priceCents===null&&!edit.images.length)delete state.overrides[input.key];else state.overrides[input.key]=edit;
  state.revision++;state.updatedAt=new Date().toISOString();custom.state(state);
  const serialized=JSON.stringify(state);if(new TextEncoder().encode(serialized).length>1024*1024)return response({error:'Se alcanzó el límite de ediciones. Reduce los enlaces guardados.'},413,origin);
  try{store.write('customizations',serialized);}catch{return response({error:'No se pudo guardar en este momento. Intenta nuevamente.'},503,origin);}
  return response({version:1,customizations:state},200,origin);
 }catch(error){return response({error:error.status===413?'La edición es demasiado grande.':'No se pudo guardar. Revisa los datos y vuelve a intentar.'},error.status||400,origin);}
}
