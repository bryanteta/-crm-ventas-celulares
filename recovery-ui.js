/* Recovery is explicit: preview reads only; confirmation commits a backed-up replacement. */
(()=>{
'use strict';
const $=s=>document.querySelector(s),store=window.LunivoSuiteStore,core=window.LunivoRecoveryCore;
const key=()=>`lunivo-suite-preview-v1:${LunivoStore.account()?'account:'+LunivoStore.account():'local'}`;
let preview=null,busy=false,shownKey=null,paintId=0,exportedProof=null;
function currentMonth(){const parts=new Intl.DateTimeFormat('en',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
function message(text){$('#recovery-message').textContent=text;$('#storage-backup-message').textContent=text;}
function clear(){preview=null;$('#recovery-preview').hidden=true;$('#recovery-confirm').disabled=true;$('#recovery-accept').checked=false;}
async function paint(){
 const k=key(),id=++paintId,error=store.state(k)==='error';$('#sales-recovery').hidden=!error||!location.hash.startsWith('#ventas');
 if(shownKey!==k){shownKey=k;clear();message('');$('#recovery-choices').replaceChildren();}
 if(!error)return;
 try{const d=await store.diagnose(k);if(id!==paintId||k!==key())return;$('#recovery-reason').textContent=d.message||'No se pudo abrir Ventas.';$('#recovery-available').textContent=[d.details.readable?'Hay datos locales legibles.':'No hay una copia local completa legible.',d.details.journal?'Se conserva un diario de guardado.':'',d.details.legacy?'Se conserva el formato anterior.':'',d.details.backups+' copia(s) interna(s).'].filter(Boolean).join(' ');
 $('#recovery-cloud').hidden=!LunivoSuiteCloud.enabled();$('#recovery-local').hidden=LunivoSuiteCloud.enabled()||['open-failed','quota','transient'].includes(d.code);$('#recovery-floor-label').hidden=$('#recovery-local').hidden;$('#recovery-new-local').hidden=$('#recovery-local').hidden;
 }catch(error){message(error.message);}
}
async function work(action){if(busy)return;busy=true;document.querySelectorAll('[data-recovery-action]').forEach(b=>b.disabled=true);try{await action();}catch(error){message(error.name==='QuotaExceededError'?'No hay espacio para guardar la copia previa. Exporta los datos para recuperación y libera espacio sin borrar los datos de Lunivo.':error.message);}finally{busy=false;document.querySelectorAll('[data-recovery-action]').forEach(b=>b.disabled=false);if(!preview)$('#recovery-confirm').disabled=true;}}
function summary(data){return `${data.sales.length} ventas · ${data.inventory.length} lotes de inventario. Correlativos: ${Object.entries(data.receiptCounters||{}).map(([m,n])=>m+': '+n).join(', ')||'sin registros'}.`;}
function prepare(copy,result,type,snapshot=null){
 const k=key();if(copy.accountKey!==k)throw Error('La cuenta cambió.');
 $('#recovery-choices').replaceChildren();
 if(!result.data){clear();message('Hay varias solicitudes sin aplicar. Elige cuál conservar para reintentar. Las demás se archivarán con las copias.');for(const op of result.choices){const b=document.createElement('button');b.type='button';b.textContent=(op.actor?.name||'Usuario')+' · '+op.kind+' · '+op.targetId;b.addEventListener('click',()=>prepare(copy,core.cloud(copy,snapshot,op.id),'cloud',snapshot));$('#recovery-choices').append(b);}return;}
 preview={key:k,copy,data:result.data,type,snapshot,signature:store.signature(copy)};$('#recovery-summary').textContent=summary(result.data);$('#recovery-preview').hidden=false;$('#recovery-confirm').disabled=true;$('#recovery-accept').checked=false;message('Vista previa: aún no se ha modificado ningún dato.');
}
$('#recovery-retry').addEventListener('click',()=>work(async()=>{clear();message('Abriendo almacenamiento…');await store.retry(key());await paint();if(store.state(key())==='ready'){message('Ventas está disponible.');LunivoSuite.render();}}));
$('#recovery-cloud').addEventListener('click',()=>work(async()=>{clear();const k=key(),copy=await store.capture(k);message('Consultando ventas, existencias, correlativos y solicitudes en el servidor…');const snapshot=await LunivoSuiteCloud.recoverySnapshot(core.operations(copy).map(op=>op.id));if(k!==key())throw Error('La cuenta cambió.');prepare(copy,core.cloud(copy,snapshot),'cloud',snapshot);}));
$('#recovery-local').addEventListener('click',()=>work(async()=>{clear();const copy=await store.capture(key()),input=$('#recovery-floor').value.trim(),floor=input===''?undefined:Number(input);prepare(copy,{data:core.local(copy,currentMonth(),floor)},'local');}));
$('#recovery-accept').addEventListener('change',()=>{$('#recovery-confirm').disabled=!preview||!$('#recovery-accept').checked;});
$('#recovery-cancel').addEventListener('click',()=>{clear();message('Vista previa cancelada. Los datos siguen intactos.');});
$('#recovery-new-local').addEventListener('click',()=>work(async()=>{const k=key();if(LunivoSuiteCloud.enabled())throw Error('Esta opción solo está disponible en modo local.');const copy=await store.capture(k);if(!exportedProof||exportedProof.key!==k||exportedProof.signature!==store.signature(copy))throw Error('Exporta primero los datos actuales para conservar una copia externa.');if(!confirm('¿Empezar un historial local nuevo? Las ventas e inventario actuales quedarán archivados y en el respaldo exportado.'))return;if(!confirm('¿Confirmas que guardaste el respaldo en privado y quieres continuar?'))return;const empty={sales:[],offers:[],inventory:[],receiptCounters:core.counters(core.sources(copy))};const floor=$('#recovery-floor').value.trim();const planned=core.local({...copy,data:empty,legacy:null,journal:null,backups:[]},currentMonth(),floor===''?undefined:Number(floor));prepare(copy,{data:planned},'local');}));
const stableSnapshot=s=>JSON.stringify([s.sales,s.inventory,s.counters,s.operations]);
$('#recovery-confirm').addEventListener('click',()=>work(async()=>{
 const planned=preview;if(!planned||planned.key!==key()||!$('#recovery-accept').checked)throw Error('Prepara y confirma la vista previa.');
 message('Verificando y guardando una copia previa…');
 if(planned.type==='cloud'){const fresh=await LunivoSuiteCloud.recoverySnapshot(core.operations(planned.copy).map(op=>op.id));if(stableSnapshot(fresh)!==stableSnapshot(planned.snapshot)){clear();throw Error('La nube cambió. Consulta otra vista previa antes de restaurar.');}}
 await store.restore(planned.key,planned.data,{reason:'user-'+planned.type+'-recovery',expected:planned.signature,guard:()=>key()===planned.key});
 clear();message('Recuperación verificada.');LunivoSuite.render();if(planned.type==='cloud')LunivoSuiteCloud.recovered();
}));
const transfers=new Map();window.addEventListener('lunivo-backup',event=>{const r=event.detail,p=transfers.get(r?.requestId);if(p)p(r);});
function bridgeStep(id,type,fields={},waitFor='chunk'){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{transfers.delete(id);reject(Error('La exportación tardó demasiado. Vuelve a intentarlo.'));},waitFor==='saved'?300000:30000);transfers.set(id,r=>{if(['error','cancelled'].includes(r.status)||r.status===waitFor){clearTimeout(timer);transfers.delete(id);r.status===waitFor?resolve(r):reject(Error(r.message));}});try{CrmAndroid.postMessage(JSON.stringify({type,requestId:id,...fields}));}catch(error){clearTimeout(timer);transfers.delete(id);reject(error);}});
}
async function exportBackup(){const k=key(),copy=await store.capture(k),text=JSON.stringify(copy),bytes=new TextEncoder().encode(text);message('Preparando respaldo. Contiene datos de clientes: guárdalo en privado.');
 if(window.CrmAndroid){const id=crypto.randomUUID(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');try{
 await bridgeStep(id,'backupExportBegin',{bytes:bytes.length,sha256:hash},'ready');
 for(let offset=0,index=0;offset<bytes.length;offset+=49152,index++){const part=bytes.subarray(offset,offset+49152);let binary='';for(const b of part)binary+=String.fromCharCode(b);await bridgeStep(id,'backupExportChunk',{index,chunk:btoa(binary)});}
 await bridgeStep(id,'backupExportEnd',{},'saved');
 }catch(error){try{CrmAndroid.postMessage(JSON.stringify({type:'backupExportCancel',requestId:id}));}catch{}throw error;}
 }else{const url=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Lunivo-respaldo-ventas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 exportedProof={key:k,signature:store.signature(copy)};if(k===key())message('Respaldo preparado. Conserva el archivo en privado.');
}
for(const id of ['recovery-export','storage-export'])$('#'+id).addEventListener('click',()=>work(exportBackup));
window.addEventListener('hashchange',paint);window.addEventListener('lunivo-suite-storage',paint);window.addEventListener('lunivo-cloud',()=>{if(shownKey!==key()){imported=null;$('#backup-import-dialog').close();clear();paint();}});
let imported=null;
function readBackup(){
 if(!window.CrmAndroid)return new Promise((resolve,reject)=>{const input=$('#backup-file');input.value='';input.onchange=async()=>{try{const file=input.files[0];if(!file){reject(Error('Importación cancelada.'));return;}if(file.size>128*1024*1024)throw Error('El respaldo supera 128 MB.');resolve(await file.text());}catch(error){reject(error);}};input.oncancel=()=>reject(Error('Importación cancelada.'));input.click();});
 return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),parts=[];let length=0;const timer=setTimeout(()=>finish(Error('La importación tardó demasiado.')),300000);
 function finish(error,text){clearTimeout(timer);transfers.delete(id);error?reject(error):resolve(text);}
 transfers.set(id,async event=>{try{if(['error','cancelled'].includes(event.status))throw Error(event.message);if(event.type==='backupImportPart'){if(event.index!==parts.length)throw Error('El respaldo llegó fuera de orden.');const part=Uint8Array.from(atob(event.chunk),c=>c.charCodeAt(0));length+=part.length;if(length>128*1024*1024)throw Error('El respaldo supera 128 MB.');parts.push(part);}if(event.type==='backupImportComplete'){const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(event.bytes!==length||event.sha256!==hash)throw Error('El respaldo llegó incompleto.');finish(null,new TextDecoder('utf-8',{fatal:true}).decode(bytes));}}catch(error){finish(error);}});
 try{CrmAndroid.postMessage(JSON.stringify({type:'backupImport',requestId:id}));}catch(error){finish(error);}
 });
}
async function importBackup(){const k=key(),text=await readBackup();if(k!==key())throw Error('La cuenta cambió.');let backup;try{backup=JSON.parse(text);}catch{throw Error('El archivo no contiene JSON válido.');}const copy=await store.capture(k),result=core.importBackup(copy,backup,{currentMonth:currentMonth(),floor:$('#recovery-floor').value.trim()===''?undefined:Number($('#recovery-floor').value)});imported={key:k,copy,backup,result};$('#backup-import-summary').textContent=`${result.added} nuevos · ${result.identical} idénticos · ${result.conflicts} diferencias archivadas. `+summary(result.data);$('#backup-import-accept').checked=false;$('#backup-import-save').disabled=true;$('#backup-import-message').textContent='Vista previa: no se ha modificado ningún dato.';$('#backup-import-dialog').showModal();}
for(const id of ['recovery-import','storage-import'])$('#'+id).addEventListener('click',()=>work(importBackup));
$('#backup-import-accept').addEventListener('change',()=>$('#backup-import-save').disabled=!imported||!$('#backup-import-accept').checked);
$('#backup-import-cancel').addEventListener('click',()=>{imported=null;$('#backup-import-dialog').close();});
$('#backup-import-dialog').addEventListener('cancel',()=>{imported=null;});
$('#backup-import-save').addEventListener('click',async()=>{if(busy||!imported||!$('#backup-import-accept').checked)return;const plan=imported;busy=true;$('#backup-import-save').disabled=true;try{if(plan.key!==key())throw Error('La cuenta cambió.');await store.restore(plan.key,plan.result.data,{reason:'backup-import',importedBackup:plan.backup,expected:store.signature(plan.copy),guard:()=>key()===plan.key});imported=null;$('#backup-import-dialog').close();LunivoSuite.render();LunivoApp.notice('Respaldo importado y verificado. La nube no se modificó.');}catch(error){$('#backup-import-message').textContent=error.name==='QuotaExceededError'?'No hay espacio para conservar las copias. Libera espacio sin borrar datos de Lunivo.':error.message;}finally{busy=false;$('#backup-import-save').disabled=!imported;}});

window.LunivoRecoveryUI={paint};
})();
