(function(root,factory){const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else root.LunivoSalesCore=core;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 function money(value){const s=String(value).trim();if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(s))throw Error('Escribe un importe válido con hasta dos decimales.');const[a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
 const DEFAULT_MARKUP=8000;
 function suggestedPrice(cost){if(!Number.isSafeInteger(cost)||cost<0||!Number.isSafeInteger(cost+DEFAULT_MARKUP))throw Error('Revisa el costo del equipo.');return cost+DEFAULT_MARKUP;}
 function totals({price,cost,expenses,quantity,accessories=0,accessoryCost=0,status='Confirmada',commissionEnabled=true}){if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('La cantidad debe estar entre 1 y 1,000.');for(const n of[price,cost,expenses,accessories,accessoryCost])if(!Number.isSafeInteger(n)||n<0)throw Error('Importes inválidos.');const revenue=price*quantity+accessories,purchase=cost*quantity+accessoryCost,commission=status==='Confirmada'&&commissionEnabled?1500:0,profit=revenue-purchase-expenses-commission;if(![revenue,purchase,profit].every(Number.isSafeInteger))throw Error('Importe demasiado grande.');return{revenue,purchase,commission,profit};}

 const OWNERS=[{id:'lunivo',name:'Lunivo'},{id:'samuel',name:'Samuel'},{id:'saul',name:'Saúl'},{id:'javier',name:'Javier'}];
 const SPLIT_OWNERS=['saul','javier'];
 const inSplit=item=>SPLIT_OWNERS.includes(item.ownerId);
 const isTecnoShop=offer=>['tecnoshop','tecnoshopsv','tech'].includes(String(offer.supplier||'').toLowerCase().replace(/[\s._-]/g,''))||String(offer.id||'').startsWith('tecno-reference-');
 const providerForOwner=id=>SPLIT_OWNERS.includes(id)?'split':id==='samuel'?'samuel':'';
 const providerFilter=value=>value==='tecnoshop'?'samuel':['samuel','split'].includes(value)?value:'';
 const providerForOffer=offer=>isTecnoShop(offer)||String(offer.supplier||'').trim().toLowerCase()==='samuel'?'samuel':/^split(?:\b|$)/i.test(offer.supplier||'')?'split':'other';
 const supplierName=offer=>providerForOffer(offer)==='samuel'?'Samuel':offer.supplier;
 const phoneFamily=item=>/\bi\s*phone\b/i.test(item.model||'')?'iphone':/samsung|galaxy/i.test((item.brand||'')+' '+(item.model||''))?'samsung':'';
 const ownerName=id=>OWNERS.find(o=>o.id===id)?.name||'Sin asignar';
 function inventoryBrand(item){if(item.brand?.trim())return item.brand.trim();const name=item.model||'';for(const[pattern,brand]of[[/iphone|apple/i,'Apple'],[/samsung|galaxy/i,'Samsung'],[/xiaomi|redmi|poco/i,'Xiaomi'],[/honor/i,'Honor'],[/huawei/i,'Huawei'],[/motorola|moto /i,'Motorola'],[/pixel|google/i,'Google']])if(pattern.test(name))return brand;return 'Sin marca';}
 function accessoryTotal(items){if(!Array.isArray(items)||items.length>30)throw Error('Revisa los accesorios de la venta.');const ids=new Set();let total=0;for(const item of items){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>150||typeof item.catalogId!=='string'||!Number.isSafeInteger(item.price)||item.price<0)throw Error('Cada accesorio debe tener un nombre y precio válidos.');ids.add(item.id);total+=item.price;}if(!Number.isSafeInteger(total))throw Error('Importe demasiado grande.');return total;}
 const variant=o=>JSON.stringify(['model','capacity','color','category','battery','notes'].map(k=>String(o[k]||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')));
 function summary(rows){const confirmed=rows.filter(r=>r.status==='Confirmada');return confirmed.reduce((a,r)=>{a.count++;a.revenue+=r.revenue;a.profit+=r.profit;a.commission+=r.commission;a.paid+=r.paidAt?r.commission:0;return a;},{count:0,revenue:0,profit:0,commission:0,paid:0});}
 function validateSale(r){
  if(!r||typeof r.id!=='string'||!['Confirmada','Borrador','Anulada'].includes(r.status))throw Error('Registro de venta inválido.');
  for(const key of ['client','model','date','sellerId','sellerName'])if(typeof r[key]!=='string'||!r[key])throw Error('Venta incompleta.');
  if(r.commissionEnabled!==undefined&&typeof r.commissionEnabled!=='boolean')throw Error('Política de venta inválida.');
  if(r.accessoryItems!==undefined&&accessoryTotal(r.accessoryItems)!==(r.accessories||0))throw Error('El detalle de accesorios no coincide con su total.');
  const t=totals({...r,status:r.status==='Borrador'?'Borrador':'Confirmada'});
  for(const key of ['revenue','profit','commission'])if(r[key]!==t[key])throw Error('Los importes guardados no coinciden. No borres los datos; requiere revisión.');
  if(r.paidAt!==null&&typeof r.paidAt!=='string')throw Error('Estado de pago inválido.');
  return true;
 }
 function applyStock(data,sale,restore=false){
  if(!sale.stockId||restore&&!sale.stockDeducted)return;
  const item=data.inventory.find(i=>i.id===sale.stockId);
  if(!item)throw Error('El producto ya no está en el inventario. Revisa la venta.');if(item.prepared)throw Error('Un equipo preparado se vende como referencia del proveedor.');
  const next=item.quantity+(restore?sale.quantity:-sale.quantity);
  if(!Number.isSafeInteger(next)||next<0)throw Error('No hay suficientes unidades disponibles.');
  if(!Number.isSafeInteger(next*item.cost))throw Error('El valor del inventario es demasiado grande.');
  item.quantity=next;sale.stockDeducted=!restore;
 }
 function editSale(data,id,patch,actor,now){
  const before=data.sales.find(r=>r.id===id);if(!before||before.status!=='Confirmada')throw Error('Solo puedes editar una venta confirmada.');
  const allowed=['client','model','date','quantity','price','cost','expenses','accessoryCost','notes','supplier','accessoryItems','accessories','receipt'];
  if(!patch||Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Hay campos de la venta que no se pueden cambiar.');
  if(!actor?.id||!actor.name)throw Error('Selecciona tu usuario en Ajustes.');const r=JSON.parse(JSON.stringify(before));
  for(const key of allowed)if(key!=='receipt'&&Object.hasOwn(patch,key))r[key]=JSON.parse(JSON.stringify(patch[key]));
  r.notes??='';r.supplier??='';
  for(const [key,max]of [['client',100],['model',2000],['notes',1000],['supplier',100]])if(typeof r[key]!=='string'||r[key].length>max||(['client','model'].includes(key)&&!r[key].trim()))throw Error('Revisa cliente, modelo, proveedor y notas.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(+new Date(r.date+'T12:00:00Z'))||new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('Revisa la fecha de venta.');
  if(before.stockId&&(r.model!==before.model||r.cost!==before.cost))throw Error('El modelo y costo del equipo propio se conservan. Para cambiar de equipo, anula la venta y registra otra.');
  if(r.accessoryItems!==undefined)r.accessories=accessoryTotal(r.accessoryItems);
  Object.assign(r,totals(r));
  const receipt=JSON.parse(JSON.stringify(before.receipt||patch.receipt||{}));for(const key of ['phone','paymentMethod','bank','months','channel'])if(patch.receipt&&Object.hasOwn(patch.receipt,key))receipt[key]=patch.receipt[key];
  receipt.number=r.saleNumber||receipt.number||'';receipt.deliveryDate=r.date;
  if(receipt.phone&&!/^[+\d\s().-]{7,30}$/.test(receipt.phone))throw Error('Revisa el número de contacto.');
  if(!['Efectivo','Transferencia','Tasa cero','Tarjeta','Otro'].includes(receipt.paymentMethod))throw Error('Selecciona el método de pago.');
  if(receipt.paymentMethod==='Tasa cero'&&(!receipt.bank||!Number.isInteger(receipt.months)||receipt.months<1||receipt.months>60))throw Error('Completa banco y meses para la tasa cero.');
  if((receipt.serials||[]).length>r.quantity)throw Error('Hay más IMEI que equipos. Revisa la garantía antes de reducir la cantidad.');
  r.receipt=receipt;r.saleEditedById=actor.id;r.saleEditedByName=actor.name;r.saleEditedAt=now;validateSale(r);
  const delta=before.quantity-r.quantity;let item,next;
  if(before.stockDeducted&&before.stockId&&delta!==0){item=data.inventory.find(i=>i.id===before.stockId);if(!item)throw Error('El equipo ya no está en Mis equipos.');next=item.quantity+delta;if(!Number.isSafeInteger(next)||next<0||!Number.isSafeInteger(next*item.cost))throw Error('No hay suficientes unidades disponibles para este cambio.');}
  if(item)item.quantity=next;data.sales=data.sales.map(s=>s.id===id?r:s);return data;
 }
 return{DEFAULT_MARKUP,suggestedPrice,editSale,money,totals,variant,summary,validateSale,applyStock,phoneFamily,OWNERS,ownerName,inventoryBrand,accessoryTotal,SPLIT_OWNERS,inSplit,isTecnoShop,providerForOwner,providerForOffer,providerFilter,supplierName};
});
