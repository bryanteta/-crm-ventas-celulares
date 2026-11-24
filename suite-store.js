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
  r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>db.close();connection=db;resolve(db);};
  r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Cierra otras pestañas de Lunivo para abrir tus ventas.'));
 });
 opening.catch(()=>{fallback=true;});
 try{navigator.storage?.persist?.().catch(()=>{});}catch{}
 return opening;
}
const range=key=>IDBKeyRange.bound([key,''],[key,'￿']);
// Splits data into strings: one per sale, the remaining fields and the order of sales.
function split(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.sales))throw Error('No se pudo leer el almacenamiento de Ventas. No borres los datos de la app.');
 // Row keys are the sale ids; malformed or repeated ids still get a row so read() reports them as before.
 const sales=new Map(),order=[];data.sales.forEach((sale,n)=>{let id=sale&&typeof sale.id==='string'&&sale.id&&!sale.id.startsWith('\u0000')?sale.id:'\u0000'+n;if(sales.has(id))id='\u0000'+n;sales.set(id,JSON.stringify(sale));order.push(id);});
 // The placeholder keeps the position of "sales" so the joined object has the original key order.
 return{sales,order,rest:JSON.stringify({...data,sales:0})};
}
function join(parts){const data=JSON.parse(parts.rest),sales=[];for(const id of parts.order){const json=parts.sales.get(id);if(json===undefined)throw Error('Falta una venta guardada. No borres los datos de la app.');sales.push(JSON.parse(json));}data.sales=sales;return data;}
const same=(a,b)=>a.rest===b.rest&&a.order.length===b.order.length&&a.order.every((id,n)=>id===b.order[n])&&a.sales.size===b.sales.size&&[...a.sales].every(([id,json])=>b.sales.get(id)===json);
// Rows to write: those that differ from the last saved copy, plus rows other unfinished commits touched.
function changes(next,base,touched){
 if(!base)return{full:true,puts:[...next.sales],deletes:[]};
 const puts=[],deletes=[];for(const[id,json]of next.sales)if(base.sales.get(id)!==json||touched.has(id))puts.push([id,json]);
 for(const id of base.sales.keys())if(!next.sales.has(id))deletes.push(id);for(const id of touched)if(!next.sales.has(id)&&!base.sales.has(id))deletes.push(id);
 return{full:false,puts,deletes};
}
function apply(tx,key,diff,rest,order,jid){
 const sales=tx.objectStore('sales');if(diff.full)sales.delete(range(key));
 for(const[id,json]of diff.puts)sales.put(json,[key,id]);for(const id of diff.deletes)sales.delete([key,id]);
 tx.objectStore('state').put({rest,order,jid,savedAt:new Date().toISOString()},key);
}
async function readParts(db,key){
 const tx=db.transaction(['state','sales'],'readonly'),finished=done(tx);
 const [state,keys,values]=await Promise.all([request(tx.objectStore('state').get(key)),request(tx.objectStore('sales').getAllKeys(range(key))),request(tx.objectStore('sales').getAll(range(key)))]);
 await finished;if(!state)return null;
 const sales=new Map();keys.forEach((k,n)=>sales.set(k[1],values[n]));return{sales,order:state.order,rest:state.rest,jid:state.jid};
}
function journalText(jid,diff,rest,order){return'{"jid":'+JSON.stringify(jid)+',"full":'+diff.full+',"rest":'+JSON.stringify(rest)+',"order":'+JSON.stringify(order)+',"puts":{'+diff.puts.map(([id,json])=>JSON.stringify(id)+':'+json).join(',')+'},"deletes":'+JSON.stringify(diff.deletes)+'}';}
function writeJournal(key,text){try{localStorage.setItem(JOURNAL+key,text);return true;}catch{try{localStorage.removeItem(JOURNAL+key);}catch{}return false;}}
function clearJournal(key,jid){try{const raw=localStorage.getItem(JOURNAL+key);if(raw!==null&&(jid===undefined||raw.startsWith('{"jid":'+JSON.stringify(jid)+',')))localStorage.removeItem(JOURNAL+key);}catch{}}
// Replays a commit that was interrupted (reload, app closed) before its transaction completed.
async function recover(db,key,stored){
 let raw=null;try{raw=localStorage.getItem(JOURNAL+key);}catch{}if(raw===null)return stored;
 let j;try{j=JSON.parse(raw);}catch{clearJournal(key);return stored;}
 if(stored&&stored.jid===j.jid){clearJournal(key);return stored;}
 if(!stored&&!j.full){clearJournal(key);return stored;}
 const diff={full:j.full,puts:Object.entries(j.puts).map(([id,sale])=>[id,JSON.stringify(sale)]),deletes:j.deletes};
 const tx=db.transaction(['state','sales'],'readwrite'),finished=done(tx);apply(tx,key,diff,j.rest,j.order,j.jid);await finished;
 clearJournal(key,j.jid);return readParts(db,key);
}
async function load(key){
 let legacy=null;try{legacy=localStorage.getItem(key);}catch{}
 let db;try{db=await database();}catch{
  // Without IndexedDB (very old WebView or blocked storage) keep the previous behaviour.
  fallback=true;return{data:JSON.parse(legacy||EMPTY),committed:null,backend:'localStorage',exists:legacy!==null};
 }
 const stored=await recover(db,key,await readParts(db,key));
 if(legacy===null)return{data:stored?join(stored):JSON.parse(EMPTY),committed:stored,backend:'indexedDB',exists:Boolean(stored)};
 // A legacy blob exists only before migration, or if an older version wrote after it: it is the newest copy.
 const parts=split(JSON.parse(legacy));
 if(!stored||!same(stored,parts)){
  const tx=db.transaction(['state','sales','backups'],'readwrite'),finished=done(tx);
  if(stored)tx.objectStore('backups').put({savedAt:new Date().toISOString(),reason:'legacy-import',data:JSON.stringify(join(stored))},[key,new Date().toISOString()]);
  apply(tx,key,changes(parts,null),parts.rest,parts.order,uid());await finished;
  const check=await readParts(db,key);if(!check||!same(check,parts))throw Error('No se pudo verificar la copia de tus ventas. Se conserva el almacenamiento anterior.');
  parts.jid=check.jid;
 }
 try{localStorage.removeItem(key);}catch{}
 return{data:join(parts),committed:parts,backend:'indexedDB',migrated:true,exists:true};
}
function entry(key){let e=entries.get(key);if(!e){e={key,status:'idle',data:null,error:null,version:0,committed:null,touched:new Set(),inflight:0,waiters:[],promise:null,exists:false};entries.set(key,e);}return e;}
function open(key){
 const e=entry(key);if(e.status==='ready'||e.promise)return e.promise||Promise.resolve();
 e.status='loading';e.error=null;
 e.promise=load(key).then(result=>{Object.assign(e,{data:result.data,committed:result.committed,backend:result.backend,exists:result.exists,status:'ready'});e.version++;emit(key,{loaded:true,migrated:Boolean(result.migrated)});},error=>{e.status='error';e.error=error;emit(key,{error});}).finally(()=>{e.promise=null;});
 return e.promise;
}
// suite.js shows QuotaExceededError with its own advice; any other storage failure gets the same plain message.
const storageError=error=>error?.name==='QuotaExceededError'?error:Object.assign(Error('No se pudieron guardar los datos. Libera espacio o permite el almacenamiento y vuelve a intentar.'),{name:'StorageError',cause:error});
function settle(e,version,error){const keep=[];for(const w of e.waiters){if(w.version>version){keep.push(w);continue;}if(error)w.reject(error);else w.resolve();}e.waiters=keep;}
// Starts one IndexedDB transaction for `parts` (and its journal). Throws synchronously if it cannot start.
function persist(e,parts,{full=false,backup=null}={}){
 const db=connection;if(!db)throw Error('No se pudo abrir el almacenamiento de Ventas.');
 const diff=full?changes(parts,null):changes(parts,e.committed,e.touched),jid=uid(),version=e.version+1;
 const tx=db.transaction(backup?['state','sales','backups']:['state','sales'],'readwrite');
 try{if(backup)tx.objectStore('backups').put(backup,[e.key,new Date().toISOString()]);apply(tx,e.key,diff,parts.rest,parts.order,jid);}catch(error){try{tx.abort();}catch{}throw storageError(error);}
 // A full rewrite (legacy import) keeps the legacy blob until saved, which already serves as its journal.
 if(!full)writeJournal(e.key,journalText(jid,diff,parts.rest,parts.order));
 e.version=version;e.inflight++;for(const[id]of diff.puts)e.touched.add(id);for(const id of diff.deletes)e.touched.add(id);
 const promise=new Promise((resolve,reject)=>e.waiters.push({version,resolve,reject}));
 done(tx).then(()=>{
  e.inflight--;parts.jid=jid;e.committed=parts;if(!e.inflight)e.touched.clear();clearJournal(e.key,jid);settle(e,version);
  if(!e.inflight){broadcast(e.key);document.dispatchEvent(new CustomEvent('lunivo-suite-saved',{detail:{key:e.key}}));}
 },error=>{
  e.inflight--;
  // A later transaction rewrites everything this one touched; its outcome settles these waiters.
  if(e.inflight)return;
  e.touched.clear();clearJournal(e.key);
  const failure=storageError(error);
  try{e.data=e.committed?join(e.committed):JSON.parse(EMPTY);}catch{}e.version++;settle(e,Infinity,failure);emit(e.key,{error:failure,reverted:true});
 });
 return promise;
}
function set(key,data){
 const e=entry(key);if(e.status!=='ready')throw Error('Espera a que se abran tus datos antes de guardar.');
 if(e.backend==='localStorage'){localStorage.setItem(key,JSON.stringify(data));e.data=data;e.exists=true;e.version++;return Promise.resolve();}
 const promise=persist(e,split(data));e.data=data;e.exists=true;return promise;
}
// The previous format reappears only if an older version or tab wrote it after migration: adopt it as the newest copy.
function adopt(e){
 if(e.backend!=='indexedDB')return;let raw=null;try{raw=localStorage.getItem(e.key);}catch{}
 if(raw===null||raw===e.adopting)return;
 const data=JSON.parse(raw),backup=e.committed?{savedAt:new Date().toISOString(),reason:'legacy-import',data:JSON.stringify(join(e.committed))}:null;
 persist(e,split(data),{full:true,backup}).then(()=>{try{if(localStorage.getItem(e.key)===raw)localStorage.removeItem(e.key);}catch{}},()=>{}).finally(()=>{if(e.adopting===raw)e.adopting=null;});
 e.data=data;e.exists=true;e.adopting=raw;
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
window.LunivoSuiteStore={
 open,set,usage,WARN,
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
