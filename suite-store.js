/* Sales suite storage in IndexedDB.
 * Each account key keeps one row per sale plus one row with everything else (offers, inventory,
 * counters, cloud metadata and the sales order). A commit writes only the rows that changed, in a
 * single transaction, so records and pending cloud operations are saved together or not at all.
 *
 * Commits update memory at once and start the transaction in the same task. Chromium aborts
 * unfinished transactions when the page reloads, so each commit also leaves a small journal in
 * localStorage with just the rows it writes; it is removed when the transaction completes and is
 * replayed on the next start if it did not. The old localStorage blob is imported once, verified
 * and removed to free its quota. */
(()=>{
'use strict';
const DB='lunivo-suite',VERSION=1,EMPTY='{"sales":[],"offers":[]}',JOURNAL='lunivo-suite-journal-v1:',LOCAL_LIMIT=5000000,WARN=0.7;
const fault=(code,message,details={})=>Object.assign(Error(message),{code,details});
const classify=e=>(typeof e?.code==='string'?e.code:null)||({QuotaExceededError:'quota',UnknownError:'transient',AbortError:'transient',InvalidStateError:'transient'}[e?.name])||'transient';
const entries=new Map(),listeners=new Set();let opening=null,connection=null,fallback=false,channel=null;
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
function emit(key,detail={}){window.dispatchEvent(new CustomEvent('lunivo-suite-storage',{detail:{key,...detail}}));for(const fn of listeners)try{fn(key,detail)}catch{}}
function request(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function done(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new DOMException('No se completó el guardado.','AbortError'));});}
function database(){
 if(opening)return opening;
 opening=new Promise((resolve,reject)=>{
  let r;try{if(!window.indexedDB)throw Error('IndexedDB no está disponible.');r=indexedDB.open(DB,VERSION);}catch(e){reject(e);return;}
  r.onupgradeneeded=()=>{const db=r.result;for(const name of['state','sales','backups'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name);};
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();if(connection===db){connection=null;opening=null;}};connection=db;resolve(db);};
  r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Cierra otras pestañas de Lunivo para abrir tus ventas.'));
 });
 opening.catch(()=>{fallback=true;});
 try{navigator.storage?.persist?.().catch(()=>{});}catch{}
 return opening;
}
const marker=key=>'lunivo-suite-indexed-v1:'+key;
function mark(key){try{localStorage.setItem(marker(key),'1');}catch{}}
const range=key=>IDBKeyRange.bound([key,''],[key,'￿']);
// Splits data into strings: one per sale, the remaining fields and the order of sales.
function split(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.sales))throw fault('journal-damaged','No se pudo leer el almacenamiento de Ventas. No borres los datos de la app.');
 // Row keys are the sale ids; malformed or repeated ids still get a row so read() reports them as before.
 const sales=new Map(),order=[];data.sales.forEach((sale,n)=>{let id=sale&&typeof sale.id==='string'&&sale.id&&!sale.id.startsWith('\u0000')?sale.id:'\u0000'+n;if(sales.has(id))id='\u0000'+n;sales.set(id,JSON.stringify(sale));order.push(id);});
 // The placeholder keeps the position of "sales" so the joined object has the original key order.
 return{sales,order,rest:JSON.stringify({...data,sales:0})};
}
function join(parts){const data=JSON.parse(parts.rest),sales=[];for(const id of parts.order){const json=parts.sales.get(id);if(json===undefined)throw Error('Falta una venta guardada. No borres los datos de la app.');sales.push(JSON.parse(json));}data.sales=sales;return data;}
// The old format reappears only if an older version wrote it after migration. That version
// could not see the sales already moved here, so its copy is merged in instead of replacing
// them: records are combined by id (the legacy copy wins, it was written last) and receipt
// counters keep the highest number so correlatives are never reused.
function mergeLegacy(current,legacy){
 if(!current||!legacy||typeof legacy!=='object'||!Array.isArray(legacy.sales))return legacy;
 const latest=row=>Math.max(0,...['createdAt','saleEditedAt','cancelledAt','visibilityChangedAt','paidAt'].map(k=>Date.parse(row?.[k])||0),Date.parse(row?.receipt?.savedAt)||0);
 const byId=(first,second,collection)=>{const existing=new Map((Array.isArray(second)?second:[]).map(r=>[r?.id,r]));const out=(Array.isArray(first)?first:[]).map(r=>{const previous=existing.get(r?.id);if(!previous)return r;if(current.cloud?.versions?.[collection]?.[r.id])return previous;if(latest(previous)>latest(r))return previous;return r;});const ids=new Set(out.map(r=>r?.id));for(const r of existing.values())if(!ids.has(r?.id))out.push(r);return out;};
 if(current.cloud?.pending&&legacy.cloud?.pending&&current.cloud.pending.id!==legacy.cloud.pending.id)throw fault('conflicting-pending','Hay dos solicitudes de nube diferentes. Se conservan ambas copias para recuperarlas.');
 const merged={...current,...legacy,sales:byId(legacy.sales,current.sales,'sales')};
 if(Array.isArray(current.inventory)||Array.isArray(legacy.inventory))merged.inventory=byId(legacy.inventory,current.inventory,'inventory');
 if(current.cloud){
  const cloud=structuredClone(current.cloud);if(!cloud.pending&&legacy.cloud?.pending)cloud.pending=structuredClone(legacy.cloud.pending);
  const migration=cloud.migration||{sales:[],inventory:[],counters:[]};let added=false;
  for(const collection of ['sales','inventory']){const ids=new Set(migration[collection]||[]);for(const row of merged[collection]||[])if((collection!=='sales'||row.status!=='Borrador')&&!cloud.versions?.[collection]?.[row.id]){ids.add(row.id);added=true;}migration[collection]=[...ids];}
  const months=new Set(migration.counters||[]);for(const [month,n]of Object.entries(legacy.receiptCounters||{}))if(Number(n)>Number(current.receiptCounters?.[month]||0)){months.add(month);added=true;}migration.counters=[...months];
  if(added||cloud.migration){cloud.imported=false;cloud.migration=migration;}merged.cloud=cloud;
 }

 const counters={...(current.receiptCounters||{})};for(const[month,n]of Object.entries(legacy.receiptCounters||{}))counters[month]=Math.max(Number(counters[month])||0,Number(n)||0);
 if(Object.keys(counters).length)merged.receiptCounters=counters;
 return merged;
}
const same=(a,b)=>a.rest===b.rest&&a.order.length===b.order.length&&a.order.every((id,n)=>id===b.order[n])&&a.sales.size===b.sales.size&&[...a.sales].every(([id,json])=>b.sales.get(id)===json);
// Rows to write: those that differ from the last saved copy, plus rows other unfinished commits touched.
function changes(next,base,touched){
 if(!base)return{full:true,puts:[...next.sales],deletes:[]};
 const puts=[],deletes=[];for(const[id,json]of next.sales)if(base.sales.get(id)!==json||touched.has(id))puts.push([id,json]);
 for(const id of base.sales.keys())if(!next.sales.has(id))deletes.push(id);for(const id of touched)if(!next.sales.has(id)&&!base.sales.has(id))deletes.push(id);
 return{full:false,puts,deletes};
}
function writeTransaction(db,names){
 try{return db.transaction(names,'readwrite',{durability:'strict'});}catch(error){if(error instanceof TypeError)return db.transaction(names,'readwrite');throw error;}
}
function apply(tx,key,diff,rest,order,jid,recoverySources=null){
 const sales=tx.objectStore('sales');if(diff.full)sales.delete(range(key));
 for(const[id,json]of diff.puts)sales.put(json,[key,id]);for(const id of diff.deletes)sales.delete([key,id]);
 tx.objectStore('state').put({rest,order,jid,recoverySources,savedAt:new Date().toISOString()},key);
}
async function readParts(db,key){
 const tx=db.transaction(['state','sales'],'readonly'),finished=done(tx);
 const [state,keys,values]=await Promise.all([request(tx.objectStore('state').get(key)),request(tx.objectStore('sales').getAllKeys(range(key))),request(tx.objectStore('sales').getAll(range(key)))]);
 await finished;if(!state)return null;
 const sales=new Map();keys.forEach((k,n)=>sales.set(k[1],values[n]));return{sales,order:state.order,rest:state.rest,jid:state.jid,recoverySources:state.recoverySources};
}
function journalText(jid,diff,rest,order,parents){return'{"jid":'+JSON.stringify(jid)+',"parents":'+JSON.stringify(parents)+',"full":'+diff.full+',"rest":'+JSON.stringify(rest)+',"order":'+JSON.stringify(order)+',"puts":{'+diff.puts.map(([id,json])=>JSON.stringify(id)+':'+json).join(',')+'},"deletes":'+JSON.stringify(diff.deletes)+'}';}
function writeJournal(key,text){try{localStorage.setItem(JOURNAL+key,text);return true;}catch{try{localStorage.removeItem(JOURNAL+key);}catch{}return false;}}
function clearJournal(key,jid){try{const raw=localStorage.getItem(JOURNAL+key);if(raw!==null&&(jid===undefined||raw.startsWith('{"jid":'+JSON.stringify(jid)+',')))localStorage.removeItem(JOURNAL+key);}catch{}}
// Replays a commit that was interrupted (reload, app closed) before its transaction completed.
const digest=async raw=>raw===null?null:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
async function recover(db,key,stored){
 let raw=null;try{raw=localStorage.getItem(JOURNAL+key);}catch{}if(raw===null)return stored;
 if(stored?.recoverySources?.journal===await digest(raw))return stored;
 let j;try{j=JSON.parse(raw);}catch{throw fault('journal-damaged','El diario de recuperación requiere revisión. Se conserva sin sobrescribir las ventas guardadas.');}
 if(!j||typeof j.rest!=='string'||!Array.isArray(j.order)||!j.puts||!Array.isArray(j.deletes)||typeof j.full!=='boolean')throw fault('journal-damaged','El diario de recuperación está incompleto.');
 if(stored&&stored.jid===j.jid){clearJournal(key);return stored;}
 if(stored&&Array.isArray(j.parents)&&!j.parents.includes(stored.jid)){
  // A stale/other writer's journal must never replace a newer confirmed state.
  const tx=writeTransaction(db,'backups'),finished=done(tx);tx.objectStore('backups').put({savedAt:new Date().toISOString(),reason:'stale-journal',journal:raw},[key,'journal-'+j.jid]);await finished;clearJournal(key,j.jid);return stored;
 }
 if(!stored&&!j.full)throw fault('journal-damaged','Falta la copia base de un guardado interrumpido. El diario se conserva para recuperar los datos.');
 const diff={full:j.full,puts:Object.entries(j.puts).map(([id,sale])=>[id,JSON.stringify(sale)]),deletes:j.deletes};
 const tx=writeTransaction(db,['state','sales']),finished=done(tx);apply(tx,key,diff,j.rest,j.order,j.jid);await finished;
 clearJournal(key,j.jid);return readParts(db,key);
}
async function load(key){
 let legacy=null;try{legacy=localStorage.getItem(key);}catch{}
 let db;try{db=await database();}catch{
  // Without IndexedDB (very old WebView or blocked storage) keep the previous behaviour.
  if(localStorage.getItem(marker(key))!==null)throw fault('open-failed','No se pudo abrir la base que contiene tus ventas. Reintenta sin borrar los datos.');
  fallback=true;return{data:JSON.parse(legacy||EMPTY),committed:null,backend:'localStorage',exists:legacy!==null};
 }
 const stored=await recover(db,key,await readParts(db,key));
 let ignoredLegacy=null;if(legacy!==null&&stored?.recoverySources?.legacy===await digest(legacy)){ignoredLegacy=legacy;legacy=null;}
 if(!stored&&localStorage.getItem(marker(key))!==null)throw fault('missing-base','Falta la base local de ventas que ya existía. Recupera tu cuenta o un respaldo antes de registrar ventas.');
 if(legacy===null)return{ignoredLegacy,data:stored?join(stored):JSON.parse(EMPTY),committed:stored,backend:'indexedDB',exists:Boolean(stored)};
 // A legacy blob exists only before migration, or if an older version wrote after it: merge it in.
 const parts=split(stored?mergeLegacy(join(stored),JSON.parse(legacy)):JSON.parse(legacy));if(stored)parts.jid=stored.jid;
 if(!stored||!same(stored,parts)){
  const tx=writeTransaction(db,['state','sales','backups']),finished=done(tx);
  if(stored)tx.objectStore('backups').put({savedAt:new Date().toISOString(),reason:'legacy-import',data:JSON.stringify(join(stored))},[key,new Date().toISOString()]);
  apply(tx,key,changes(parts,null),parts.rest,parts.order,uid());await finished;
  const check=await readParts(db,key);if(!check||!same(check,parts))throw Error('No se pudo verificar la copia de tus ventas. Se conserva el almacenamiento anterior.');
  parts.jid=check.jid;
 }
 try{localStorage.removeItem(key);}catch{}mark(key);
 return{data:join(parts),committed:parts,backend:'indexedDB',migrated:true,exists:true};
}
function entry(key){let e=entries.get(key);if(!e){e={key,status:'idle',data:null,error:null,version:0,committed:null,touched:new Set(),jids:new Set(),inflight:0,waiters:[],promise:null,exists:false};entries.set(key,e);}return e;}
function open(key){
 const e=entry(key);if(e.status==='ready'||e.promise)return e.promise||Promise.resolve();
 e.status='loading';e.error=null;
 e.promise=load(key).then(result=>{Object.assign(e,{data:result.data,committed:result.committed,backend:result.backend,exists:result.exists,ignoredLegacy:result.ignoredLegacy,status:'ready'});e.version++;emit(key,{loaded:true,migrated:Boolean(result.migrated)});},error=>{e.status='error';e.error=Object.assign(Error(error.message),{code:classify(error),name:error.name,cause:error});emit(key,{error});}).finally(()=>{e.promise=null;});
 return e.promise;
}
// suite.js shows QuotaExceededError with its own advice; any other storage failure gets the same plain message.
const storageError=error=>error?.name==='QuotaExceededError'?error:Object.assign(Error('No se pudieron guardar los datos. Libera espacio o permite el almacenamiento y vuelve a intentar.'),{name:'StorageError',cause:error});
function settle(e,version,error){const keep=[];for(const w of e.waiters){if(w.version>version){keep.push(w);continue;}if(error)w.reject(error);else w.resolve();}e.waiters=keep;}
// Starts one IndexedDB transaction for `parts` (and its journal). Throws synchronously if it cannot start.
function persist(e,parts,{full=false,backup=null}={}){
 const db=connection;if(!db)throw Error('No se pudo abrir el almacenamiento de Ventas.');
 const diff=full?changes(parts,null):changes(parts,e.committed,e.touched),jid=uid(),version=e.version+1;
 const tx=writeTransaction(db,backup?['state','sales','backups']:['state','sales']);
 try{if(backup)tx.objectStore('backups').put(backup,[e.key,new Date().toISOString()]);parts.recoverySources=e.committed?.recoverySources;apply(tx,e.key,diff,parts.rest,parts.order,jid,parts.recoverySources);}catch(error){try{tx.abort();}catch{}throw storageError(error);}
 // A full rewrite (legacy import) keeps the legacy blob until saved, which already serves as its journal.
 if(!full)writeJournal(e.key,journalText(jid,diff,parts.rest,parts.order,[e.committed?.jid??null,...e.jids]));
 e.version=version;e.inflight++;e.jids.add(jid);for(const[id]of diff.puts)e.touched.add(id);for(const id of diff.deletes)e.touched.add(id);
 const promise=new Promise((resolve,reject)=>e.waiters.push({version,resolve,reject}));
 done(tx).then(()=>{
  e.inflight--;e.jids.delete(jid);mark(e.key);parts.jid=jid;e.committed=parts;if(!e.inflight)e.touched.clear();clearJournal(e.key,jid);settle(e,version);
  if(!e.inflight){broadcast(e.key);document.dispatchEvent(new CustomEvent('lunivo-suite-saved',{detail:{key:e.key}}));}
 },error=>{
  e.inflight--;e.jids.delete(jid);
  // A later transaction rewrites everything this one touched; its outcome settles these waiters.
  if(e.inflight)return;
  e.touched.clear();clearJournal(e.key);
  const failure=storageError(error);
  try{e.data=e.committed?join(e.committed):JSON.parse(EMPTY);}catch{}e.version++;settle(e,Infinity,failure);emit(e.key,{error:failure,reverted:true});
 });
 return promise;
}
function set(key,data){
 const e=entry(key);if(e.status==='error'||e.restoring)throw fault('blocked','Recupera Ventas antes de guardar cambios.');if(e.status!=='ready')throw Error('Espera a que se abran tus datos antes de guardar.');
 if(e.backend==='localStorage'){localStorage.setItem(key,JSON.stringify(data));e.data=data;e.exists=true;e.version++;return Promise.resolve();}
 const promise=persist(e,split(data));e.data=data;e.exists=true;return promise;
}
// The previous format reappears only if an older version or tab wrote it after migration: merge it in.
function adopt(e){try{
 if(e.backend!=='indexedDB')return;let raw=null;try{raw=localStorage.getItem(e.key);}catch{}
 if(raw===null||raw===e.adopting||raw===e.ignoredLegacy)return;
 const data=mergeLegacy(e.data,JSON.parse(raw)),backup=e.committed?{savedAt:new Date().toISOString(),reason:'legacy-import',data:JSON.stringify(join(e.committed))}:null;
 persist(e,split(data),{full:true,backup}).then(()=>{try{if(localStorage.getItem(e.key)===raw)localStorage.removeItem(e.key);}catch{}},()=>{}).finally(()=>{if(e.adopting===raw)e.adopting=null;});
 e.data=data;e.exists=true;e.adopting=raw;
 }catch(error){e.status='error';e.error=Object.assign(Error(error.message),{name:error.name,code:classify(error)});queueMicrotask(()=>emit(e.key,{error:e.error}));throw e.error;}
}
function broadcast(key){try{channel?.postMessage({key});}catch{}}
try{channel=new BroadcastChannel('lunivo-suite-storage');channel.onmessage=async event=>{const key=event.data?.key,e=entries.get(key);if(!e||e.status!=='ready'||e.inflight||e.backend!=='indexedDB')return;try{const parts=await readParts(await database(),key);if(!parts||e.inflight)return;e.committed=parts;e.data=join(parts);e.exists=true;e.version++;emit(key,{external:true});}catch{}};}catch{}
async function usage(){
 let local=0;try{for(let n=0;n<localStorage.length;n++){const k=localStorage.key(n);local+=k.length+(localStorage.getItem(k)||'').length;}}catch{}
 let used=null,quota=null;try{const estimate=await navigator.storage?.estimate?.();if(estimate){used=estimate.usage??null;quota=estimate.quota??null;}}catch{}
 let sales=0;for(const e of entries.values())if(e.status==='ready')sales+=e.data.sales.length;
 const localRatio=local/LOCAL_LIMIT,dbRatio=used!==null&&quota?used/quota:0;
 return{local,localLimit:LOCAL_LIMIT,localRatio,used,quota,dbRatio,sales,backend:fallback?'localStorage':'indexedDB',warning:Math.max(localRatio,dbRatio)>=WARN};
}
// Recovery inspection never replays journals, imports old blobs, or writes to the cloud.
async function capture(key){
 const result={format:'lunivo-sales-backup',version:1,exportedAt:new Date().toISOString(),accountKey:key,appVersion:'1.7.35-rc.1',data:null,journal:localStorage.getItem(JOURNAL+key),legacy:localStorage.getItem(key),marker:localStorage.getItem(marker(key)),backups:[],raw:null};
 try{const db=await database(),tx=db.transaction(['state','sales','backups'],'readonly'),finished=done(tx);
 const [state,keys,values,bkeys,backups]=await Promise.all([request(tx.objectStore('state').get(key)),request(tx.objectStore('sales').getAllKeys(range(key))),request(tx.objectStore('sales').getAll(range(key))),request(tx.objectStore('backups').getAllKeys(range(key))),request(tx.objectStore('backups').getAll(range(key)))]);await finished;
 result.raw={state:state??null,keys,values};result.ignored={legacy:result.legacy!==null&&state?.recoverySources?.legacy===await digest(result.legacy),journal:result.journal!==null&&state?.recoverySources?.journal===await digest(result.journal)};result.backups=backups.map((value,n)=>({key:bkeys[n],value}));
 if(state)try{result.data=join({rest:state.rest,order:state.order,sales:new Map(keys.map((k,n)=>[k[1],values[n]]))});}catch{}
 }catch(error){result.readError={code:classify(error),message:error.message};}
 return result;
}
const signature=copy=>JSON.stringify([copy.accountKey,copy.raw,copy.journal,copy.legacy,copy.marker]);
async function diagnose(key){const copy=await capture(key),error=entry(key).error;return{code:error?classify(error):null,details:{journal:copy.journal!==null,legacy:copy.legacy!==null,backups:copy.backups.length,readable:Boolean(copy.data),database:!copy.readError},message:error?.message||''};}
async function retry(key){const e=entry(key);if(e.restoring||e.inflight)throw Error('Espera a que termine el guardado.');if(e.promise)await e.promise;
 if(['open-failed','transient'].includes(classify(e.error))){if([...entries.values()].some(v=>v.inflight))throw Error('Espera a que terminen los guardados.');connection?.close();connection=null;opening=null;fallback=false;}e.status='idle';return open(key);}
async function restore(key,data,{reason='recovery',expected,importedBackup=null,guard=()=>true}={}){
 const e=entry(key);if(e.restoring||e.inflight)throw Error('Hay un guardado en curso.');e.restoring=true;
 try{
 const copy=await capture(key);if(copy.readError)throw fault('open-failed','Reintenta abrir el almacenamiento antes de restaurar.');
 if(expected!==signature(copy)||!guard())throw Error('Los datos o la cuenta cambiaron. Prepara otra vista previa.');
 data=structuredClone(data);data.receiptCounters??={};for(const[m,n]of Object.entries(window.LunivoRecoveryCore.counters(window.LunivoRecoveryCore.sources(copy))))data.receiptCounters[m]=Math.max(data.receiptCounters[m]||0,n);
 window.LunivoRecoveryCore.validate(data);
 const parts=split(data);parts.recoverySources={legacy:await digest(copy.legacy),journal:await digest(copy.journal)};
 const db=await database(),tx=writeTransaction(db,['state','sales','backups']),finished=done(tx);finished.catch(()=>{});
 const jid=uid();
 try{
 // Check the state again in the same serialized write transaction (other tabs may have saved).
 const [prior,priorKeys,priorValues]=await Promise.all([request(tx.objectStore('state').get(key)),request(tx.objectStore('sales').getAllKeys(range(key))),request(tx.objectStore('sales').getAll(range(key)))]);if(JSON.stringify({state:prior??null,keys:priorKeys,values:priorValues})!==JSON.stringify(copy.raw)||localStorage.getItem(JOURNAL+key)!==copy.journal||localStorage.getItem(key)!==copy.legacy||!guard())throw Error('La copia cambió. Prepara otra vista previa.');
 tx.objectStore('backups').put({savedAt:new Date().toISOString(),reason,importedBackup,restoredCounters:data.receiptCounters,copy:{...copy,backups:[]}},[key,'recovery-'+jid]);
 apply(tx,key,changes(parts,null),parts.rest,parts.order,jid,parts.recoverySources);
 const [state,keys,values]=await Promise.all([request(tx.objectStore('state').get(key)),request(tx.objectStore('sales').getAllKeys(range(key))),request(tx.objectStore('sales').getAll(range(key)))]);
 const check={rest:state.rest,order:state.order,sales:new Map(keys.map((k,n)=>[k[1],values[n]]))};if(!same(check,parts)||!guard())throw Error('No se pudo verificar la recuperación.');
 }catch(error){try{tx.abort();}catch{}await finished.catch(()=>{});throw error;}
 await finished;
 // Originals are archived in the same committed transaction; failed/cancelled writes leave them intact.
 try{if(localStorage.getItem(key)===copy.legacy)localStorage.removeItem(key);if(localStorage.getItem(JOURNAL+key)===copy.journal)localStorage.removeItem(JOURNAL+key);}catch{}
 mark(key);parts.jid=jid;Object.assign(e,{data:join(parts),committed:parts,backend:'indexedDB',exists:true,error:null,ignoredLegacy:copy.legacy,status:'ready'});e.version++;broadcast(key);emit(key,{restored:true,external:true});
 return data;
 }finally{e.restoring=false;}
}
window.LunivoSuiteStore={
 open,set,usage,WARN,diagnose,retry,capture,restore,signature,
 state:key=>entry(key).status,
 error:key=>entry(key).error,
 version:key=>entry(key).version,
 get:key=>{const e=entry(key);if(e.status==='error')throw e.error;if(e.status!=='ready')return null;adopt(e);return e.data;},
 // Serialized copy of the current data, for diagnostics and tests. Synchronous; null while loading or never saved.
 peek:key=>{const e=entries.get(key);if(!e||e.status!=='ready')return null;adopt(e);return e.exists?JSON.stringify(e.data):null;},
 // Replaces an account's data as if another session wrote it (tests, restores). The promise settles when saved.
 write:(key,json)=>{const run=()=>{const p=set(key,typeof json==='string'?JSON.parse(json):json);emit(key,{external:true});return p;};return entry(key).status==='ready'?run():open(key).then(run);},
 saved:key=>{const e=entries.get(key);return!e||!e.inflight?Promise.resolve():new Promise((resolve,reject)=>e.waiters.push({version:e.version,resolve,reject}));},
 onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}
};
})();
