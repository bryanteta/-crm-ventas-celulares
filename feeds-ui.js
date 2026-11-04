(()=>{
'use strict';
const $=s=>document.querySelector(s),core=window.LunivoFeedCore,bridge=window.LunivoInventoryAndroid;
let api=null,scope=null,bootstrapAttempted=false,keyKnown=false,configured=false,stateRequested=false,bootstrapBusy=false;
let errors={},working=new Set(),attempted=new Map();const pending=new Map(),TTL=10*60*1000;
const account=()=>window.LunivoStore.account()||'local',active=()=>['#ventas/proveedores','#ventas/inventario'].includes(location.hash.split('?')[0]);
function native(type,fields={}){
 if(!bridge)return Promise.reject(Error('Abre Lunivo para Android para actualizar los inventarios.'));
 const id=crypto.randomUUID(),requestScope=scope;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('El proveedor tardó demasiado. Se conserva la lista guardada.'));},40000);pending.set(id,{resolve,reject,timer,scope:requestScope});try{bridge.postMessage(JSON.stringify({type,id,scope:requestScope,...fields}));}catch{clearTimeout(timer);pending.delete(id);reject(Error('No se pudo iniciar la conexión.'));}});
}
if(bridge)bridge.onmessage=event=>{try{const data=JSON.parse(event.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);if(data.scope!==p.scope||data.scope!==account())p.reject(Error('La cuenta cambió.'));else if(data.ok)p.resolve(data);else p.reject(Error(data.message||'No se pudo actualizar. Se conserva la lista anterior.'));}catch{/* Ignore unrelated or malformed messages. */}};
function ensureScope(){
 const next=account();if(next===scope)return;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('La cuenta cambió.'));}pending.clear();scope=next;bootstrapAttempted=false;bootstrapBusy=false;keyKnown=false;configured=false;stateRequested=false;errors={};working=new Set();attempted=new Map();$('#split-feed-key').value='';
}
function current(expected){return scope===expected&&account()===expected&&api.ready();}
async function state(){if(!bridge||stateRequested)return;stateRequested=true;const expected=scope;try{const r=await native('state');if(current(expected)){keyKnown=true;configured=r.configured;render(api.read());}}catch(e){if(current(expected)){$('#feed-key-status').textContent=e.message;}}}
async function bootstrap(){
 if(!bridge||bootstrapAttempted||!api.ready())return;bootstrapAttempted=true;if(api.read().providerFeeds?.samuel&&api.read().providerFeeds?.split){render(api.read());return;}bootstrapBusy=true;const expected=scope;paint(api.read());
 try{const response=await fetch('assets/provider-bootstrap.json');if(!response.ok)throw Error('No hay copia de inventario incluida. Pulsa Actualizar para obtener los datos.');const snapshot=await response.json();if(snapshot.version!==1||!snapshot.providers||!Number.isFinite(Date.parse(snapshot.checkedAt)))throw Error('La copia incluida no es válida.');for(const p of['samuel','split'])core.validate(p,snapshot.providers[p]);
  if(!current(expected))return;let changed=false;api.commit(data=>{for(const p of['samuel','split'])if(!data.providerFeeds?.[p]){data=core.replace(data,p,snapshot.providers[p],snapshot.checkedAt,'included');changed=true;}return data;});if(changed)api.render();
 }catch(e){if(current(expected)&&!api.read().providerFeeds?.samuel)errors.samuel=api.errorText(e);}finally{if(current(expected)){bootstrapBusy=false;render(api.read());}}
}
async function refresh(provider,manual=false){
 if(!bridge||working.has(provider)||!api.ready())return;if(provider==='split'&&!configured){if(manual)errors.split='Para actualizar Split, guarda su clave en Ajustes. La copia incluida sigue disponible.';paint(api.read());return;}
 const expected=scope;working.add(provider);attempted.set(provider,Date.now());delete errors[provider];paint(api.read());
 try{const response=await native('refresh',{provider});const parsed=core[provider](response.body);if(!current(expected))return;api.commit(data=>core.replace(data,provider,parsed,new Date().toISOString()));api.render();}
 catch(e){if(current(expected))errors[provider]=api.errorText(e);}
 finally{if(current(expected)){working.delete(provider);paint(api.read());}}
}
function paint(data){
 $('#provider-refresh').hidden=!bridge;$('#provider-refresh').disabled=bootstrapBusy||working.size>0;$('#provider-refresh').textContent=working.size?'Actualizando…':'Actualizar inventarios';
 const total=['samuel','split'].reduce((n,p)=>n+(data.providerFeeds?.[p]?.total||0),0),hasLists=Boolean(data.providerFeeds?.samuel||data.providerFeeds?.split);$('#feed-info').hidden=!bridge&&!hasLists;$('#feed-info-title').textContent=working.size?'Actualizando inventarios…':hasLists?total+' equipos · Ver estado de actualización':bootstrapBusy?'Cargando inventarios…':'Estado de inventarios';if(Object.keys(errors).length)$('#feed-info').open=true;
 const target=$('#feed-status');target.replaceChildren();for(const p of['samuel','split']){const meta=data.providerFeeds?.[p],row=document.createElement('p');row.className='feed-source-status';const name=p==='split'?'Split':'Samuel';let text=name+': ';
  if(working.has(p))text+='actualizando…';else if(meta){const when=new Intl.DateTimeFormat('es-SV',{timeZone:'America/El_Salvador',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(meta.checkedAt));text+=meta.total+' equipos · '+(meta.origin==='included'?'Copia incluida':'Consultado')+' '+when;if(p==='split'){const rows=data.offers.filter(o=>o.feedProvider==='split');text+=' · Saúl '+rows.filter(o=>o.ownerId==='saul').reduce((n,o)=>n+o.quantity,0)+' / Javier '+rows.filter(o=>o.ownerId==='javier').reduce((n,o)=>n+o.quantity,0);}}
  else text+=bootstrapBusy?'cargando inventario…':'sin inventario descargado.';
  if(errors[p])text+=' · '+errors[p];else if(p==='split'&&bridge&&keyKnown&&!configured)text+=' · Clave en Ajustes para actualizar.';
  row.textContent=text;if(p==='split'&&bridge&&keyKnown&&!configured){const link=document.createElement('a');link.href='#ajustes';link.textContent='Conectar Split';row.append(document.createTextNode(' '),link);}target.append(row);
 }
 $('#feed-settings').hidden=!bridge;$('#feed-key-status').textContent=keyKnown?(configured?'Clave de Split guardada en este teléfono para tu cuenta.':'Guarda la clave de revendedor para actualizar Split. Samuel no necesita clave.'):'Comprobando conexión…';$('#split-feed-forget').disabled=!configured;
}
function render(data){if(!api)return;ensureScope();paint(data);if(!bridge||!api.ready())return;state();if(!active())return;if(!bootstrapAttempted){bootstrap();return;}if(bootstrapBusy)return;for(const provider of['samuel','split']){const meta=data.providerFeeds?.[provider];if(Date.now()-(attempted.get(provider)||0)>=TTL&&(!meta||Date.now()-Date.parse(meta.checkedAt)>TTL)&&(provider==='samuel'||keyKnown&&configured))refresh(provider);}}
$('#provider-refresh').addEventListener('click',()=>{refresh('samuel',true);refresh('split',true);});
$('#split-feed-form').addEventListener('submit',async event=>{event.preventDefault();if(!api||!api.ready()||!event.target.reportValidity())return;ensureScope();const expected=scope,key=$('#split-feed-key').value.trim();$('#split-feed-key').value='';$('#split-feed-save').disabled=true;try{const r=await native('saveKey',{key});if(current(expected)){configured=r.configured;keyKnown=true;delete errors.split;attempted.delete('split');$('#feed-key-status').textContent='Clave guardada. Actualizando Split…';refresh('split',true);}}catch(e){if(current(expected))$('#feed-key-status').textContent=e.message;}finally{$('#split-feed-save').disabled=false;}});
$('#split-feed-forget').addEventListener('click',async()=>{ensureScope();const expected=scope;try{await native('clearKey');if(current(expected)){configured=false;keyKnown=true;paint(api.read());}}catch(e){if(current(expected))$('#feed-key-status').textContent=e.message;}});
for(const type of['hashchange','lunivo-cloud'])window.addEventListener(type,()=>{if(api){try{render(api.read());}catch{/* The suite reports damaged data. */}}});
window.LunivoFeeds={connect(value){api=value;},render};
})();
