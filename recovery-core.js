/* Pure recovery planning: no storage, bridge calls, or server writes. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.LunivoRecoveryCore=api;})(globalThis,()=>{
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)),month=/^\d{4}-(0[1-9]|1[0-2])$/;
function validate(data){
 if(!data||!Array.isArray(data.sales)||!Array.isArray(data.inventory)||!Array.isArray(data.offers))throw Error('El respaldo no contiene datos de Ventas válidos.');
 for(const list of [data.sales,data.inventory,data.offers]){const ids=new Set();for(const row of list){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))throw Error('Hay identificadores repetidos o inválidos.');ids.add(row.id);}}
 for(const row of data.sales){if(globalThis.LunivoSalesCore)globalThis.LunivoSalesCore.validateSale(row);else if(typeof row.date!=='string'||typeof row.status!=='string')throw Error('Venta inválida.');}
 for(const row of data.inventory)if(typeof row.model!=='string'||!Number.isSafeInteger(row.quantity)||row.quantity<0||!Number.isSafeInteger(row.cost)||row.cost<0||!Number.isSafeInteger(row.quantity*row.cost))throw Error('Inventario inválido.');
 for(const row of data.offers)if(typeof row.model!=='string'||typeof row.supplier!=='string'||!Number.isSafeInteger(row.price)||row.price<0||!Number.isInteger(row.quantity)||row.quantity<0)throw Error('Oferta inválida.');
 for(const [m,n]of Object.entries(data.receiptCounters||{}))if(!month.test(m)||!Number.isSafeInteger(n)||n<0)throw Error('Correlativo inválido.');
 return data;
}
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return null;}};
function sources(copy){
 const out=[];function visit(c,depth=0){if(!c||depth>4)return;for(const v of[c.data,c.ignored?.legacy?null:parse(c.legacy)])if(v&&typeof v==='object')out.push(v);
 const j=c.ignored?.journal?null:parse(c.journal);if(j&&typeof j.rest==='string'){const rest=parse(j.rest);if(rest)out.push({...rest,sales:Object.values(j.puts||{})});}
 for(const b of c.backups||[]){const v=b.value||b;if(v.importedBackup)visit(v.importedBackup,depth+1);if(v.copy)visit(v.copy,depth+1);else if(v.data){const data=parse(v.data);if(data)out.push(data);}if(v.journal)visit({journal:v.journal},depth+1);}
 }visit(copy);return out;
}
function counters(rows){const out={};for(const data of rows){for(const[m,n]of Object.entries(data.receiptCounters||{})){if(!month.test(m)||!Number.isSafeInteger(n)||n<0)throw Error('Hay un correlativo ilegible. Exporta las copias para revisarlo.');out[m]=Math.max(out[m]||0,n);}
 for(const sale of Array.isArray(data.sales)?data.sales:[]){const m=sale.saleMonth||sale.date?.slice(0,7);let n=sale.saleSequence;if(!Number.isSafeInteger(n)&&(sale.saleNumber||sale.receipt?.number)){const number=String(sale.saleNumber||sale.receipt.number);if(m&&number.startsWith(m.slice(5))&&/^\d+$/.test(number.slice(2)))n=Number(number.slice(2));}if(month.test(m)&&Number.isSafeInteger(n)&&n>=0)out[m]=Math.max(out[m]||0,n);}}
 return out;}
function operations(copy){const map=new Map();for(const data of sources({...copy,backups:[]}))if(data.cloud?.pending){const op=data.cloud.pending;if(typeof op.id!=='string'||!op.id)throw Error('Solicitud pendiente inválida.');const prev=map.get(op.id);if(prev&&JSON.stringify(prev)!==JSON.stringify(op))throw Error('Una solicitud tiene dos contenidos distintos. Exporta las copias para revisión.');map.set(op.id,op);}return [...map.values()];}
function base(copy){const rows=sources(copy);return clone(copy.data||rows[0]||{sales:[],inventory:[],offers:[]});}
function cloud(copy,snapshot,selected){
 const uid=copy.accountKey.split(':account:')[1];if(!uid||snapshot.uid!==uid||snapshot.fromCache!==false||snapshot.complete!==true)throw Error('Se necesita una copia completa del servidor para la cuenta actual.');
 const data=base(copy),versions={sales:{},inventory:{}},drafts=new Map();for(const src of sources({...copy,backups:[]}))for(const sale of Array.isArray(src.sales)?src.sales:[])if(sale.status==='Borrador'&&!drafts.has(sale.id))drafts.set(sale.id,sale);
 for(const name of ['sales','inventory']){if(!Array.isArray(snapshot[name]))throw Error('La copia del servidor está incompleta.');data[name]=snapshot[name].map(doc=>{if(!doc.record||doc.record.id!==doc.id||typeof doc.revision!=='string')throw Error('Registro compartido inválido.');versions[name][doc.id]=doc.revision;if(name==='sales')drafts.delete(doc.id);return clone(doc.record);});}
 data.sales.push(...drafts.values());data.offers=Array.isArray(data.offers)?data.offers:[];
 if(!Array.isArray(snapshot.counters))throw Error('Faltan los correlativos del servidor.');const serverCounters={};for(const c of snapshot.counters){if(!month.test(c.month)||!Number.isSafeInteger(c.sequence)||c.sequence<0)throw Error('Correlativo del servidor inválido.');serverCounters[c.month]=Math.max(serverCounters[c.month]||0,c.sequence);}
 data.receiptCounters=counters([...sources(copy),data,{sales:[],receiptCounters:serverCounters}]);
 const pending=operations(copy).filter(op=>{if(!Object.hasOwn(snapshot.operations||{},op.id)||typeof snapshot.operations[op.id]!=='boolean')throw Error('Falta comprobar una solicitud pendiente en el servidor.');return !snapshot.operations[op.id];});
 if(pending.length>1&&!pending.some(op=>op.id===selected))return{choices:pending,data:null};
 data.cloud={version:1,imported:true,versions};if(pending.length)data.cloud.pending=clone(pending.find(op=>op.id===selected)||pending[0]);
 // Reserve higher local counters through the existing idempotent import path before new sales.
 const floors=Object.keys(data.receiptCounters).filter(m=>data.receiptCounters[m]>(serverCounters[m]||0));if(floors.length){data.cloud.imported=false;data.cloud.migration={sales:[],inventory:[],counters:floors};}
 validate(data);return{data,choices:pending,drafts:drafts.size};
}
function local(copy,currentMonth,floor){
 const data=base(copy);data.sales=Array.isArray(data.sales)?data.sales:[];data.inventory=Array.isArray(data.inventory)?data.inventory:[];data.offers=Array.isArray(data.offers)?data.offers:[];
 if(operations(copy).length)throw Error('Hay solicitudes de nube. Recupera desde la cuenta correspondiente.');
 data.receiptCounters=counters([...sources(copy),data]);if(!Object.hasOwn(data.receiptCounters,currentMonth)){if(!Number.isSafeInteger(floor)||floor<0)throw Error('Indica el último número emitido este mes (0 si no emitiste ninguno).');data.receiptCounters[currentMonth]=floor;}else if(floor!==undefined){if(!Number.isSafeInteger(floor)||floor<0)throw Error('Correlativo inválido.');data.receiptCounters[currentMonth]=Math.max(data.receiptCounters[currentMonth],floor);}
 delete data.cloud;return validate(data);
}
function importBackup(copy,backup,{currentMonth,floor}={}){
 if(!backup||backup.format!=='lunivo-sales-backup'||backup.version!==1||backup.accountKey!==copy.accountKey)throw Error('El respaldo es incompatible o pertenece a otra cuenta.');
 const incoming=clone(backup.data||parse(backup.legacy));validate(incoming);const data=base(copy);data.sales??=[];data.inventory??=[];data.offers??=[];validate(data);
 let added=0,identical=0,conflicts=incoming.cloud?.pending&&incoming.cloud.pending.id!==data.cloud?.pending?.id?1:0;const addedIds={sales:[],inventory:[]};const latest=row=>Math.max(0,...['createdAt','saleEditedAt','cancelledAt','visibilityChangedAt','paidAt'].map(k=>Date.parse(row?.[k])||0),Date.parse(row?.receipt?.savedAt)||0);
 for(const name of ['sales','inventory','offers']){const byId=new Map(data[name].map(row=>[row.id,row]));for(const row of incoming[name]){const current=byId.get(row.id);if(!current){byId.set(row.id,row);added++;if(name!=='offers'&&(name!=='sales'||row.status!=='Borrador'))addedIds[name].push(row.id);}else if(JSON.stringify(current)===JSON.stringify(row))identical++;else if(!data.cloud?.versions?.[name]?.[row.id]&&latest(row)>latest(current)){byId.set(row.id,row);conflicts++;}else conflicts++;}data[name]=[...byId.values()];}
 data.receiptCounters=counters([...sources(copy),incoming]);
 if(copy.accountKey.includes(':account:')){
  if(operations(copy).length>1)throw Error('Resuelve las solicitudes pendientes consultando la nube antes de importar.');
  const meta=data.cloud||{version:1,imported:false,versions:{sales:{},inventory:{}}};meta.versions??={sales:{},inventory:{}};const migration=meta.migration||{sales:[],inventory:[],counters:[]};for(const name of ['sales','inventory'])migration[name]=[...new Set([...(migration[name]||[]),...addedIds[name]])];migration.counters=[...new Set([...(migration.counters||[]),...Object.keys(data.receiptCounters)])];meta.migration=migration;meta.imported=false;meta.recoveryImportPaused=true;data.cloud=meta;
 }else{delete data.cloud;if(copy.marker!==null&&!copy.data&&currentMonth&&!Object.hasOwn(data.receiptCounters,currentMonth)){if(!Number.isSafeInteger(floor)||floor<0)throw Error('Indica el último número emitido este mes antes de importar.');data.receiptCounters[currentMonth]=floor;}}
 validate(data);return{data,added,identical,conflicts};
}
return{validate,sources,counters,operations,cloud,local,importBackup};
});
