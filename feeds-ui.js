(()=>{
'use strict';
const $=s=>document.querySelector(s),core=window.LunivoFeedCore,bridge=window.LunivoInventoryAndroid;
let api=null,scope=null,bootstrapAttempted=false,keyKnown=false,configured=false,stateRequested=false,bootstrapBusy=false;
let errors={},working=new Set(),attempted=new Map(),keyWorking=false,keyVersion=0,keyProblem='';const pending=new Map(),TTL=10*60*1000;
const account=()=>window.LunivoStore.account()||'local',active=()=>['#ventas','#ventas/proveedores','#ventas/inventario'].includes(location.hash.split('?')[0]);
function native(type,fields={}){
 if(!bridge)return Promise.reject(Error('Abre Lunivo para Android para actualizar los inventarios.'));
 const id=crypto.randomUUID(),requestScope=scope;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('El proveedor tardó demasiado. Se conserva la lista guardada.'));},40000);pending.set(id,{resolve,reject,timer,scope:requestScope});try{bridge.postMessage(JSON.stringify({type,id,scope:requestScope,...fields}));}catch{clearTimeout(timer);pending.delete(id);reject(Error('No se pudo iniciar la conexión.'));}});
}
if(bridge)bridge.onmessage=event=>{try{const data=JSON.parse(event.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);if(data.scope!==p.scope||data.scope!==account())p.reject(Error('La cuenta cambió.'));else if(data.ok)p.resolve(data);else p.reject(Error(data.message||'No se pudo actualizar. Se conserva la lista anterior.'));}catch{/* Ignore unrelated or malformed messages. */}};
function ensureScope(){
 const next=account();if(next===scope)return;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('La cuenta cambió.'));}pending.clear();scope=next;bootstrapAttempted=false;bootstrapBusy=false;keyKnown=false;configured=false;stateRequested=false;errors={};working=new Set();attempted=new Map();keyWorking=false;keyVersion++;keyProblem='';$('#split-feed-key').value='';
}
function current(expected){return scope===expected&&account()===expected&&api.ready();}
async function state(force=false){if(!bridge||stateRequested&&!force)return;stateRequested=true;const expected=scope,version=keyVersion;try{const r=await native('state');if(current(expected)&&version===keyVersion){keyKnown=true;configured=r.configured;keyProblem='';render(api.read());}}catch(e){if(current(expected)&&version===keyVersion){keyProblem=e.message;paint(api.read());}}}
async function bootstrap(){
 if(!bridge||bootstrapAttempted||!api.ready())return;bootstrapAttempted=true;if(api.read().providerFeeds?.samuel&&api.read().providerFeeds?.split){render(api.read());return;}bootstrapBusy=true;const expected=scope;paint(api.read());
 try{const response=await fetch('assets/provider-bootstrap.json');if(!response.ok)throw Error('No hay copia de inventario incluida. Pulsa Actualizar para obtener los datos.');const snapshot=await response.json();if(snapshot.version!==1||!snapshot.providers||!Number.isFinite(Date.parse(snapshot.checkedAt)))throw Error('La copia incluida no es válida.');for(const p of['samuel','split'])core.validate(p,snapshot.providers[p]);
  if(!current(expected))return;let changed=false;api.commit(data=>{for(const p of['samuel','split'])if(!data.providerFeeds?.[p]){data=core.replace(data,p,snapshot.providers[p],snapshot.checkedAt,'included');changed=true;}return data;});if(changed)api.render();
 }catch(e){if(current(expected)&&!api.read().providerFeeds?.samuel)errors.samuel=api.errorText(e);}finally{if(current(expected)){bootstrapBusy=false;render(api.read());}}
}
async function refresh(provider,manual=false){
 if(!bridge||working.has(provider)||!api.ready())return;if(provider==='split'&&!configured){if(manual)errors.split='Para actualizar Split, guarda su clave en Ajustes. La copia incluida sigue disponible.';paint(api.read());return;}
 const expected=scope;working.add(provider);attempted.set(provider,Date.now());delete errors[provider];paint(api.read());
 try{const response=await native('refresh',{provider});const parsed=provider==='samuel'?core.samuelApi(response.body):core.split(response.body);if(!current(expected))return;api.commit(data=>core.replace(data,provider,parsed,new Date().toISOString()));api.render();}
 catch(e){if(current(expected))errors[provider]=api.errorText(e);}
 finally{if(current(expected)){working.delete(provider);paint(api.read());}}
}
function paint(data){
 $('#provider-refresh').hidden=!bridge;$('#provider-refresh').disabled=bootstrapBusy||working.size>0||keyWorking;$('#provider-refresh').textContent=working.size?'Actualizando…':'Actualizar';
 const phoneRows=data.offers.filter(o=>!window.LunivoSalesCore.devices.isWearable(o)),total=phoneRows.filter(o=>['samuel','split'].includes(o.feedProvider)).reduce((n,o)=>n+o.quantity,0),hasLists=Boolean(data.providerFeeds?.samuel||data.providerFeeds?.split);$('#feed-info').hidden=!bridge&&!hasLists;$('#feed-info-title').textContent=working.size?'Actualizando inventarios…':hasLists?total+' equipos · Ver estado de actualización':bootstrapBusy?'Cargando inventarios…':'Estado de inventarios';if(Object.keys(errors).length)$('#feed-info').open=true;
 const selected=window.LunivoSalesCore.providerFilter(new URLSearchParams(location.hash.split('?')[1]||'').get('provider')),dates=(selected?[data.providerFeeds?.[selected]]:Object.values(data.providerFeeds||{})).filter(Boolean).map(m=>Date.parse(m.checkedAt)).filter(Number.isFinite);const latest=dates.length?new Intl.DateTimeFormat('es-SV',{timeZone:'America/El_Salvador',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(Math.min(...dates))):'';const problem=Object.keys(errors).length>0;
 $('#inventory-sync-status').textContent=working.size?'Actualizando equipos…':problem?'No se actualizó '+Object.keys(errors).map(p=>p==='split'?'Split':'Samuel').join(' y ')+'. Se conserva la lista.':latest?'Consulta: '+latest:bootstrapBusy?'Cargando equipos…':'Consulta la disponibilidad antes de vender.';$('#inventory-sync-help').hidden=!problem;
 const target=$('#feed-status');target.replaceChildren();for(const p of['samuel','split']){const meta=data.providerFeeds?.[p],row=document.createElement('p');row.className='feed-source-status';const name=p==='split'?'Split':'Samuel';let text=name+': ';
  if(working.has(p))text+='actualizando…';else if(meta){const when=new Intl.DateTimeFormat('es-SV',{timeZone:'America/El_Salvador',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(meta.checkedAt));text+=phoneRows.filter(o=>o.feedProvider===p).reduce((n,o)=>n+o.quantity,0)+' equipos · '+(meta.origin==='included'?'Copia incluida':'Consultado')+' '+when;if(p==='split'){const rows=phoneRows.filter(o=>o.feedProvider==='split');text+=' · Saúl '+rows.filter(o=>o.ownerId==='saul').reduce((n,o)=>n+o.quantity,0)+' / Javier '+rows.filter(o=>o.ownerId==='javier').reduce((n,o)=>n+o.quantity,0);}}
  else text+=bootstrapBusy?'cargando inventario…':'sin inventario descargado.';
  if(errors[p])text+=' · '+errors[p];else if(p==='split'&&bridge&&keyKnown&&!configured)text+=' · Clave en Ajustes para actualizar.';
  row.textContent=text;if(p==='split'&&bridge&&keyKnown&&!configured){const link=document.createElement('a');link.href='#ajustes';link.textContent='Conectar Split';row.append(document.createTextNode(' '),link);}target.append(row);
 }
 $('#feed-settings').hidden=!bridge;$('#feed-key-status').textContent=keyProblem||(keyWorking?'Actualizando la clave en este teléfono…':keyKnown?(configured?'Clave de Split guardada en este teléfono para tu cuenta.':'Guarda la clave de revendedor para actualizar Split. Samuel no necesita clave.'):'Comprobando conexión…');$('#split-feed-forget').disabled=keyWorking||!configured;$('#split-feed-save').disabled=keyWorking;$('#split-feed-key').disabled=keyWorking;
}
function render(data){if(!api)return;ensureScope();paint(data);if(!bridge||!api.ready())return;state();if(!active())return;if(!bootstrapAttempted){bootstrap();return;}if(bootstrapBusy)return;for(const provider of['samuel','split']){const meta=data.providerFeeds?.[provider];if(Date.now()-(attempted.get(provider)||0)>=TTL&&(!meta||Date.now()-Date.parse(meta.checkedAt)>TTL)&&(provider==='samuel'||keyKnown&&configured))refresh(provider);}}
$('#provider-refresh').addEventListener('click',async()=>{if(!keyKnown)await state(true);refresh('samuel',true);refresh('split',true);});
$('#split-feed-form').addEventListener('submit',async event=>{event.preventDefault();if(!api||!api.ready()||keyWorking||!event.target.reportValidity())return;ensureScope();const expected=scope,key=$('#split-feed-key').value.trim();if(!/^[A-Za-z0-9_-]{8,256}$/.test(key)){keyProblem='Revisa la clave: usa entre 8 y 256 letras, números, guiones o guiones bajos.';paint(api.read());$('#split-feed-key').focus();return;}const version=++keyVersion;keyWorking=true;keyProblem='';$('#split-feed-key').value='';paint(api.read());try{const r=await native('saveKey',{key});if(current(expected)&&version===keyVersion){configured=r.configured;keyKnown=true;delete errors.split;attempted.delete('split');refresh('split',true);}}catch(e){if(current(expected)&&version===keyVersion)keyProblem=e.message;}finally{if(current(expected)&&version===keyVersion){keyWorking=false;paint(api.read());}}});
$('#split-feed-forget').addEventListener('click',async()=>{if(!api||!api.ready()||keyWorking)return;ensureScope();const expected=scope,version=++keyVersion;keyWorking=true;keyProblem='';paint(api.read());try{await native('clearKey');if(current(expected)&&version===keyVersion){configured=false;keyKnown=true;delete errors.split;}}catch(e){if(current(expected)&&version===keyVersion)keyProblem=e.message;}finally{if(current(expected)&&version===keyVersion){keyWorking=false;paint(api.read());}}});
for(const type of['hashchange','lunivo-cloud'])window.addEventListener(type,()=>{if(api){try{render(api.read());}catch{/* The suite reports damaged data. */}}});
window.LunivoFeeds={connect(value){api=value;},render};
})();
