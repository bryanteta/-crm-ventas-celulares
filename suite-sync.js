/* Shared business records use online, idempotent transactions. Drafts and supplier feeds stay local. */
(()=>{
'use strict';
const bridge=window.CrmAndroid,$=s=>document.querySelector(s);let api=null,scope=null,ready=false,migrating=false,working=false,problem='',lastRetry=0;
const pending=new Map(),clone=value=>JSON.parse(JSON.stringify(value)),shared=()=>Boolean(bridge&&window.LunivoStore.account());
function account(){return window.LunivoStore.account();}
function metadata(data){
 if(data.cloud===undefined)data.cloud={version:1,imported:false,versions:{sales:{},inventory:{}},migration:{inventory:data.inventory.map(i=>i.id),sales:data.sales.filter(s=>s.status!=='Borrador').map(s=>s.id),counters:Object.keys(data.receiptCounters||{})}};
 if(!data.cloud||data.cloud.version!==1||!data.cloud.versions||!data.cloud.versions.sales||!data.cloud.versions.inventory)throw Error('No se pudo leer el estado de Ventas compartidas. No borres los datos de la app.');
 return data.cloud;
}
function current(uid){return api&&uid===scope&&uid===account()&&api.ready();}
function changeScope(){const uid=account();if(uid===scope)return;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('La cuenta cambió. La solicitud queda guardada en su cuenta original.'));}pending.clear();scope=uid;ready=false;migrating=false;working=false;problem='';lastRetry=0;}
function send(type,fields={}){
 const uid=scope,requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('La nube tardó demasiado. Reintenta la misma solicitud para evitar duplicados.'));},45000);pending.set(requestId,{uid,resolve,reject,timer});try{bridge.postMessage(JSON.stringify({type,uid,requestId,...fields}));}catch{clearTimeout(timer);pending.delete(requestId);reject(Error('No se pudo contactar con Ventas compartidas.'));}});
}
function online(){try{return shared()&&ready&&navigator.onLine&&api.ready()&&window.LunivoProfiles.pending().length===0;}catch{return false;}}
function merge(data,collection,documents,reset=false,fromCache=true){
 const meta=metadata(data);let rows=data[collection];if(reset&&!fromCache&&meta.imported)rows=collection==='sales'?rows.filter(row=>row.status==='Borrador'):[];
 const map=new Map(rows.map(row=>[row.id,row]));for(const doc of documents){if(!doc||typeof doc.id!=='string')throw Error('La nube devolvió un registro inválido.');if(doc.removed){map.delete(doc.id);delete meta.versions[collection][doc.id];continue;}if(!doc.record||doc.record.id!==doc.id||typeof doc.revision!=='string')throw Error('No se pudo leer un registro compartido.');if(collection==='sales')window.LunivoSalesCore.validateSale(doc.record);else if(!Number.isSafeInteger(doc.record.quantity)||doc.record.quantity<0||!Number.isSafeInteger(doc.record.cost)||doc.record.cost<0)throw Error('No se pudo leer el inventario compartido.');map.set(doc.id,doc.record);meta.versions[collection][doc.id]=doc.revision;}
 data[collection]=[...map.values()];return data;
}
function write(data,uid=scope){if(!current(uid))throw Error('La cuenta cambió.');api.write(data,uid);}
function paint(){
 const banner=$('#suite-cloud-status');if(!banner||!api)return;banner.hidden=!shared()||!(location.hash.startsWith('#ventas')||location.hash==='#ajustes');let request=null,meta=null;try{if(shared()&&api.ready()){meta=metadata(api.read());request=meta.pending;}}catch(e){problem=e.message;}
 const count=meta?.migration?Object.values(meta.migration).reduce((n,ids)=>n+ids.length,0):0;
 const urgent=Boolean(request||problem||migrating||meta&&!meta.imported);if(urgent)banner.open=true;else if(banner.dataset.urgent==='true')banner.open=false;banner.dataset.urgent=String(urgent);
 $('#suite-cloud-title').textContent=request?'Operación pendiente de confirmar':migrating||meta&&!meta.imported?'Preparando Ventas compartidas':online()?'Ventas compartidas':'Tu copia está disponible';
 $('#suite-cloud-copy').textContent=problem||(request?'Se conserva la solicitud de '+request.actor.name+'. Se recuperará al volver la conexión. Reintentar usa el mismo identificador y evita duplicados.':migrating||meta&&!meta.imported?'Conecta este teléfono para compartir sus registros anteriores. Pendientes: '+count+'.':online()?'Ventas, garantías y Mis equipos se comparten con esta cuenta. Cada operación guarda su usuario.':'Puedes consultar los datos guardados y preparar borradores. Conecta el teléfono para confirmar ventas o modificar el inventario.');
 $('#suite-cloud-retry').disabled=working||migrating||!navigator.onLine;$('#suite-cloud-retry').textContent=request?'Reintentar solicitud':'Sincronizar Ventas';
 for(const selector of['#sale-form','#stock-form','#warranty-form','#sale-edit-form','#prepared-form']){const form=$(selector);form.inert=Boolean(request);form.setAttribute('aria-busy',String(Boolean(request)));}
 if(shared()){$('#sale-edit-save').disabled=Boolean(request)||working;$('#prepared-save').disabled=Boolean(request)||working;}$('#sale-action-confirm').disabled=Boolean(request)||working;for(const input of document.querySelectorAll('#sale-action input,#sale-action textarea'))input.readOnly=Boolean(request);
 $('#stock-organize-form button[type=submit]').disabled=Boolean(request)||working;$('#sale-action-close').textContent=request?'Cerrar':'Cancelar';$('#stock-organize-close').textContent=request?'Cerrar':'Cancelar';
 if(!shared())for(const selector of['#sale-form','#stock-form','#warranty-form','#sale-edit-form','#prepared-form'])$(selector).inert=false;
}
function refresh(){api?.render();paint();}
async function migrate(){
 if(!online()||migrating||working)return;const uid=scope;let data,meta;migrating=true;problem='';
 try{data=api.read();meta=metadata(data);if(meta.imported)return;write(data);paint();for(const collection of['inventory','sales','counters']){
  while(current(uid)&&online()){
   data=api.read();meta=metadata(data);const ids=meta.migration?.[collection]||[];if(!ids.length)break;const batch=ids.slice(0,30),records=collection==='counters'?batch.map(month=>({id:month,month,sequence:data.receiptCounters[month]})):batch.map(id=>data[collection].find(r=>r.id===id));if(records.some(r=>!r))throw Error('Falta un registro anterior. Se conserva la copia de este teléfono.');
   const result=await send('cloudSuiteImport',{collection,records});if(!current(uid))return;data=api.read();meta=metadata(data);if(collection!=='counters')merge(data,collection,result.documents);const done=new Set(result.documents.map(d=>d.id));meta.migration[collection]=meta.migration[collection].filter(id=>!done.has(id));write(data,uid);refresh();
  }
 }
 if(current(uid)){data=api.read();meta=metadata(data);if(Object.values(meta.migration||{}).every(ids=>ids.length===0)){meta.imported=true;delete meta.migration;write(data,uid);}}
 }catch(e){if(current(uid))problem=e.message;}finally{if(current(uid)){migrating=false;refresh();}}
}
async function run(operation,recovered=false){
 const uid=scope;working=true;problem='';paint();
 try{const result=await send('cloudSuiteCommit',{operation});if(!current(uid))throw Error('La cuenta cambió.');const data=api.read(),meta=metadata(data);for(const name of['sales','inventory'])merge(data,name,result.documents?.[name]||[]);if(result.counter){data.receiptCounters??={};data.receiptCounters[result.counter.month]=Math.max(data.receiptCounters[result.counter.month]||0,result.counter.sequence);}if(meta.pending?.id===operation.id)delete meta.pending;write(data,uid);problem='';refresh();window.dispatchEvent(new CustomEvent('lunivo-suite-committed',{detail:{kind:operation.kind,targetId:operation.targetId,recovered,replayed:result.replayed}}));return result;
 }catch(e){if(current(uid)){if(e.definitive){try{const data=api.read(),meta=metadata(data);if(meta.pending?.id===operation.id)delete meta.pending;write(data,uid);}catch{}}problem=e.message;refresh();}throw e;
 }finally{if(current(uid)){working=false;paint();}}
}
async function retry(){
 changeScope();if(!shared()||!api.ready())return;problem='';try{bridge.postMessage(JSON.stringify({type:'cloudSuiteState',uid:scope}));const data=api.read(),meta=metadata(data);write(data);if(meta.pending){if(working||!online())return;lastRetry=Date.now();await run(meta.pending,true);}else await migrate();}catch(e){problem=e.message;paint();}
}
async function mutate(kind,values,targetId){
 changeScope();if(!shared())throw Error('La cuenta no está vinculada.');if(!api.ready())throw Error('Espera a que se abra tu cuenta.');let data=api.read(),meta=metadata(data);if(meta.pending)throw Error('Hay una solicitud pendiente. Usa Reintentar solicitud antes de registrar otra operación.');
 const actor=window.LunivoProfileUI.current();if(!actor)throw Error('Selecciona tu usuario en Ajustes antes de guardar.');
 if(kind==='confirmSale'){
  const draft=clone(values.sale);draft.status='Borrador';draft.stockDeducted=false;delete draft.saleNumber;delete draft.saleSequence;delete draft.saleMonth;if(draft.receipt)draft.receipt.number='';data.sales=data.sales.some(s=>s.id===targetId)?data.sales.map(s=>s.id===targetId?draft:s):[draft,...data.sales];
 }
 if(!online()||!meta.imported){if(kind==='confirmSale')write(data);throw Error(kind==='confirmSale'?'Borrador guardado. Conecta el teléfono y espera la sincronización para confirmar sin duplicar existencias ni correlativos.':'Conecta el teléfono y espera la sincronización de tu usuario para guardar cambios compartidos.');}
 const collection=['confirmSale','setSaleVisibility','editSale','saveWarranty','cancelSale'].includes(kind)?'sales':'inventory',operation={id:crypto.randomUUID(),kind,targetId,actor:{id:actor.id,name:actor.name},values:clone(values)};if(!['confirmSale','addStock','restock'].includes(kind))operation.expectedRevision=values.expectedRevision??meta.versions[collection][targetId]??'';
 meta.pending=operation;write(data);return run(operation);
}
window.addEventListener('lunivo-cloud',event=>{
 const response=event.detail;if(!api||!response||typeof response.type!=='string')return;changeScope();
 if(response.type==='cloudState'){paint();if(shared()&&api.ready()){try{bridge.postMessage(JSON.stringify({type:'cloudSuiteState',uid:scope}));}catch{}}return;}
 if(!response.type.startsWith('cloudSuite')){if(shared()&&ready&&!migrating&&!working)queueMicrotask(()=>migrate());return;}
 if(response.uid!==scope||!current(scope))return;
 try{
  if(response.requestId){const p=pending.get(response.requestId);if(p&&p.uid===scope){pending.delete(response.requestId);clearTimeout(p.timer);if(response.type==='cloudSuiteError'){const error=Object.assign(Error(response.message),{definitive:response.definitive,code:response.code});p.reject(error);}else p.resolve(response);return;}}
  if(response.type==='cloudSuiteSnapshot'){let data=api.read();merge(data,response.collection,response.documents,response.reset,response.fromCache);write(data);refresh();}
  else if(response.type==='cloudSuiteState'){ready=Boolean(response.ready);paint();if(online()&&!working&&!migrating){const meta=metadata(api.read());if(meta.pending&&Date.now()-lastRetry>30000){lastRetry=Date.now();run(meta.pending,true).catch(()=>{});}else if(!meta.pending)migrate();}}
  else if(response.type==='cloudSuiteError'){problem=response.message;paint();}
 }catch(e){problem=e.message;paint();}
});
window.addEventListener('online',retry);window.addEventListener('offline',paint);window.addEventListener('hashchange',paint);
$('#suite-cloud-retry').addEventListener('click',retry);
window.LunivoSuiteCloud={enabled:shared,mutate,paint,revision(collection,id){try{return shared()?metadata(api.read()).versions[collection][id]||'':null;}catch{return null;}},connect(value){api=value;changeScope();paint();if(shared()&&api.ready())retry();}};
})();
