(function(root,factory){const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else root.LunivoSalesCore=core;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 function money(value){const s=String(value).trim();if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(s))throw Error('Escribe un importe válido con hasta dos decimales.');const[a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
 function totals({price,cost,expenses,quantity,accessories=0,accessoryCost=0,status='Confirmada',commissionEnabled=true}){if(!Number.isInteger(quantity)||quantity<1||quantity>1000)throw Error('La cantidad debe estar entre 1 y 1,000.');for(const n of[price,cost,expenses,accessories,accessoryCost])if(!Number.isSafeInteger(n)||n<0)throw Error('Importes inválidos.');const revenue=price*quantity+accessories,purchase=cost*quantity+accessoryCost,commission=status==='Confirmada'&&commissionEnabled?1500:0,profit=revenue-purchase-expenses-commission;if(![revenue,purchase,profit].every(Number.isSafeInteger))throw Error('Importe demasiado grande.');return{revenue,purchase,commission,profit};}

 const OWNERS=[{id:'samuel',name:'Samuel'},{id:'saul',name:'Saúl'},{id:'javier',name:'Javier'}];
 const SPLIT_OWNERS=['saul','javier'];
 const inSplit=item=>SPLIT_OWNERS.includes(item.ownerId);
 const isTecnoShop=offer=>['tecnoshop','tecnoshopsv','tech'].includes(String(offer.supplier||'').toLowerCase().replace(/[\s._-]/g,''))||String(offer.id||'').startsWith('tecno-reference-');
 const providerForOwner=id=>SPLIT_OWNERS.includes(id)?'split':id==='samuel'?'samuel':'';
 const providerFilter=value=>value==='tecnoshop'?'samuel':['samuel','split'].includes(value)?value:'';
 const providerForOffer=offer=>isTecnoShop(offer)||String(offer.supplier||'').trim().toLowerCase()==='samuel'?'samuel':/^split(?:\b|$)/i.test(offer.supplier||'')?'split':'other';
 const supplierName=offer=>providerForOffer(offer)==='samuel'?'Samuel':offer.supplier;
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
  if(!item)throw Error('El producto ya no está en el inventario. Revisa la venta.');
  const next=item.quantity+(restore?sale.quantity:-sale.quantity);
  if(!Number.isSafeInteger(next)||next<0)throw Error('No hay suficientes unidades disponibles.');
  if(!Number.isSafeInteger(next*item.cost))throw Error('El valor del inventario es demasiado grande.');
  item.quantity=next;sale.stockDeducted=!restore;
 }
 return{money,totals,variant,summary,validateSale,applyStock,OWNERS,ownerName,inventoryBrand,accessoryTotal,SPLIT_OWNERS,inSplit,isTecnoShop,providerForOwner,providerForOffer,providerFilter,supplierName};
});
