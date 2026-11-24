(()=>{
'use strict';
// Web catalog prices shared with the public site. The catalog Worker is the only
// source of truth: the app reads its public snapshot and edits through the same
// authorized API as the web administration, so a change on either side is the
// one both show. Only prices are edited here; saved web photos are preserved.
const $=s=>document.querySelector(s),custom=window.LunivoCatalogCustomizations,identity=window.LunivoCatalogIdentity,sales=window.LunivoSalesCore;
const CACHE='lunivo-web-prices-v1',TTL=60*1000,feeds=()=>window.LunivoFeeds;
const currencyFormat=new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}),money=n=>currencyFormat.format(n/100);
let api=null,state=load(),index=new Map(),indexSignature=null,pendingSignature=null,lastRead=0,reading=null,readProblem='';
let scope=null,configured=null,checking=null,keyWorking=false,keyProblem='',saving=new Set();
// Cards re-render after every change; keep each open editor and its last message.
const notes=new Map(),openOffers=new Set();
function load(){try{const raw=localStorage.getItem(CACHE);return raw?custom.state(JSON.parse(raw)):custom.empty();}catch{return custom.empty();}}
function persist(){try{localStorage.setItem(CACHE,JSON.stringify(state));}catch{/* The public snapshot is reloaded next time. */}}
function changed(){window.dispatchEvent(new Event('lunivo-web-prices'));paintSettings();}
const available=()=>Boolean(custom&&identity&&feeds()?.available());
const account=()=>window.LunivoStore?.account()||'local';
async function sha256(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
const feedRows=offers=>(offers||[]).filter(o=>o&&o.source==='feed'&&['samuel','split'].includes(o.feedProvider));
// Same grouping, product ID and customization key as the public catalog build.
async function sync(offers){
 if(!available())return;const rows=feedRows(offers),signature=rows.map(o=>o.id).sort().join('|');
 if(signature===indexSignature||signature===pendingSignature)return;pendingSignature=signature;
 try{
  const grouped=identity.group(['samuel','split'].flatMap(provider=>rows.filter(o=>o.feedProvider===provider).map(row=>({provider,row})))),products=new Map();
  for(const product of new Set(grouped.rows.values()))products.set(product,{productId:(await sha256(product.mergeKey)).slice(0,20),key:await custom.key({...product.specs,sourceInitials:product.sourceInitials}),automatic:product.priceCents});
  if(pendingSignature!==signature)return;
  index=new Map([...grouped.rows].map(([id,product])=>[id,products.get(product)]));indexSignature=signature;changed();
 }catch{/* Unpublishable data keeps the automatic price. */}
 finally{if(pendingSignature===signature)pendingSignature=null;}
}
function info(o){
 const automatic=sales.suggestedPrice(o.price),entry=index.get(o.id);
 if(!entry)return {linked:false,automatic,price:automatic,custom:false};
 const edit=state.overrides[entry.key]||null,manual=edit?.priceCents;
 return {linked:true,...entry,automatic,edit,custom:Number.isSafeInteger(manual),price:Number.isSafeInteger(manual)?manual:automatic};
}
const price=o=>{try{return info(o).price;}catch{return sales.suggestedPrice(o.price);}};
const signature=o=>{const i=info(o),note=notes.get(o.id);return [i.linked,i.price,i.custom,configured,saving.has(i.key),openOffers.has(o.id),note?.text,note?.error].join('|');};
const opened=o=>openOffers.has(o.id),toggle=(o,value)=>{if(value)openOffers.add(o.id);else{openOffers.delete(o.id);notes.delete(o.id);}};
async function refresh(force=false){
 if(!available()||document.visibilityState==='hidden')return;if(reading)return reading;if(!force&&Date.now()-lastRead<TTL)return;
 reading=(async()=>{try{const response=await feeds().native('catalogRead',{},'El catálogo web tardó demasiado. Se conservan los precios guardados.');const next=custom.state(JSON.parse(response.body));lastRead=Date.now();readProblem='';
  if(JSON.stringify(next)!==JSON.stringify(state)){state=next;persist();changed();}else paintSettings();}
  catch(error){readProblem=error.message||'No se pudieron consultar los precios web. Se conservan los guardados.';paintSettings();}
  finally{reading=null;}})();
 return reading;
}
function ensureScope(){const next=account();if(next===scope)return;scope=next;configured=null;checking=null;keyProblem='';const input=$('#web-price-key');if(input)input.value='';}
async function checkKey(){
 if(!available())return;ensureScope();if(configured!==null||checking)return checking;const expected=scope;
 checking=(async()=>{try{const r=await feeds().native('catalogState',{},'El catálogo web tardó demasiado.');if(scope===expected){configured=r.configured;keyProblem='';changed();}}catch(error){if(scope===expected){keyProblem=error.message;paintSettings();}}finally{if(scope===expected)checking=null;}})();
 return checking;
}
async function setPrice(o,priceCents){
 const entry=info(o);if(!entry.linked)throw Error('Este equipo todavía no se publica en la web. Actualiza el inventario e intenta de nuevo.');
 if(configured!==true)throw Error('Guarda la clave del catálogo web en Ajustes para cambiar precios.');
 if(saving.has(entry.key))return;
 const current=state.overrides[entry.key]||null,images=current?.images||[];let method,body;
 if(priceCents===null&&!images.length){if(!current)return;method='DELETE';body={key:entry.key,expectedRevision:state.revision,expectedEdit:current};}
 else{const patch=custom.patch({priceCents,images});method='PUT';body={key:entry.key,productId:entry.productId,expectedRevision:state.revision,expectedEdit:current,patch};}
 saving.add(entry.key);changed();
 try{
  const response=await feeds().native('catalogEdit',{method,body:JSON.stringify(body)},'El catálogo web tardó demasiado. Revisa el precio antes de intentarlo otra vez.');
  let data;try{data=JSON.parse(response.body);}catch{throw Error('El catálogo web no respondió correctamente.');}
  if(response.status===200){state=custom.state(data.customizations);persist();lastRead=Date.now();return;}
  if(response.status===401){configured=false;throw Error('La clave del catálogo web ya no es válida. Guárdala de nuevo en Ajustes.');}
  if(response.status===409){await refresh(true);throw Error((data.error||'Hay cambios más recientes.')+' Se cargó el precio actual de la web.');}
  throw Error(data.error||'No se pudo guardar el precio web.');
 }finally{saving.delete(entry.key);changed();}
}
// Card editor: one price field, save and back to the automatic price.
function editor(o){
 if(!available()||o.source!=='feed')return null;const i=info(o),box=document.createElement('div');box.className='web-price-editor';
 const title=document.createElement('p');title.className='web-price-title';title.textContent=i.custom?'Precio web personalizado: '+money(i.price)+' · Automático: '+money(i.automatic):'Precio web automático: '+money(i.automatic);box.append(title);
 const note=document.createElement('p');note.className='hint';note.setAttribute('role','status');
 if(!i.linked){note.textContent='Este equipo todavía no se publica en la web.';box.append(note);return box;}
 if(configured!==true){note.textContent=configured===false?'Para cambiar el precio web, guarda la clave del catálogo en ':'Comprobando la clave del catálogo web…';if(configured===false){const link=document.createElement('a');link.href='#ajustes';link.textContent='Ajustes';note.append(link,document.createTextNode('.'));}box.append(note);return box;}
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),actions=document.createElement('div'),save=document.createElement('button'),restore=document.createElement('button');
 label.textContent='Precio web al contado (USD)';input.type='text';input.inputMode='decimal';input.autocomplete='off';input.className='web-price-input';input.value=(i.price/100).toFixed(2);label.append(input);
 actions.className='actions';save.type='submit';save.textContent='Guardar precio web';restore.type='button';restore.className='secondary';restore.textContent='Usar automático';restore.disabled=!i.custom;
 const busy=saving.has(i.key),last=notes.get(o.id);save.disabled=input.disabled=busy;restore.disabled=busy||!i.custom;if(busy)note.textContent='Guardando en la web…';else if(last){note.textContent=last.text;note.classList.toggle('error',last.error);}
 actions.append(save,restore);form.append(label,actions);box.append(form,note);
 const run=async value=>{openOffers.add(o.id);notes.delete(o.id);note.textContent='Guardando en la web…';try{await setPrice(o,value);notes.set(o.id,{text:value===null?'Precio automático restaurado en la web y en la app.':'Precio web guardado. La web lo mostrará en menos de un minuto.',error:false});}catch(error){window.LunivoWebPrices.lastError=error.message;notes.set(o.id,{text:error.message,error:true});}changed();};
 const invalid=text=>{note.textContent=text;note.classList.add('error');input.focus();};
 form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim().replace(/^\$\s*/,'');if(!/^\d{1,6}(?:\.\d{1,2})?$/.test(text)){invalid('Escribe un precio válido con hasta dos decimales.');return;}const cents=Math.round(Number(text)*100);if(cents<100||cents>10000000){invalid('El precio debe estar entre $1.00 y $100,000.00.');return;}// Typing the automatic price clears the manual one so it keeps following cost.
  run(cents===i.automatic?null:cents);});
 restore.addEventListener('click',()=>{if(confirm('¿Volver al precio automático en la web y en la app?'))run(null);});
 return box;
}
function paintSettings(){
 const panel=$('#web-price-settings');if(!panel)return;panel.hidden=!available();if(!available())return;
 const status=$('#web-price-status');status.textContent=keyProblem||(keyWorking?'Comprobando la clave con el catálogo web…':configured===null?'Comprobando conexión…':configured?'Clave guardada en este teléfono. Puedes cambiar precios web desde Inventario.':'Guarda la misma clave de administración de la web para cambiar precios desde la app.')+(readProblem&&!keyProblem?' '+readProblem:'');
 $('#web-price-forget').disabled=keyWorking||!configured;$('#web-price-save').disabled=keyWorking;
}
function connect(value){api=value;}
function render(){if(!available()){paintSettings();return;}ensureScope();checkKey();try{if(api?.ready())sync(api.read().offers);}catch{/* Damaged data is reported by the suite. */}if(location.hash.startsWith('#ventas')||location.hash.startsWith('#ajustes'))refresh();paintSettings();}
$('#web-price-form')?.addEventListener('submit',async event=>{event.preventDefault();if(keyWorking||!available()||!event.target.reportValidity())return;ensureScope();const expected=scope,key=$('#web-price-key').value.trim();keyWorking=true;keyProblem='';paintSettings();
 try{await feeds().native('catalogSaveKey',{key},'El catálogo web tardó demasiado. La clave no se guardó.');if(scope===expected){configured=true;$('#web-price-key').value='';refresh(true);}}
 catch(error){if(scope===expected)keyProblem=error.message;}finally{keyWorking=false;changed();}});
$('#web-price-forget')?.addEventListener('click',async()=>{if(keyWorking||!available())return;ensureScope();const expected=scope;keyWorking=true;keyProblem='';paintSettings();
 try{await feeds().native('catalogClearKey',{},'El catálogo web tardó demasiado.');if(scope===expected)configured=false;}catch(error){if(scope===expected)keyProblem=error.message;}finally{keyWorking=false;changed();}});
for(const type of['hashchange','lunivo-cloud'])window.addEventListener(type,render);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render();});
window.LunivoWebPrices={connect,render,sync,info,price,signature,editor,opened,toggle,setPrice,refresh,lastError:''};
})();
