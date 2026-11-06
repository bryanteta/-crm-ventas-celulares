(()=>{'use strict';const $=s=>document.querySelector(s),core=window.LunivoSalesCore,dialog=$('#prepared-device'),format=new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}),money=n=>format.format(n/100);let api=null,source=null,scope=null,existingId=null,revision=null,saving=false;
function latest(p,data){if(p.stockId){const item=data.inventory.find(i=>i.id===p.stockId);return item?{price:item.cost,quantity:item.quantity}:null;}return data.offers.find(o=>o.id===p.id)||null;}
function preview(){try{const price=core.money($('#prepared-price').value);$('#prepared-margin').textContent='Aumento sobre el proveedor: '+money(price-source.price);for(const b of document.querySelectorAll('[data-prepared-increase]'))b.setAttribute('aria-pressed',String(price===source.price+Number(b.dataset.preparedIncrease)*100));}catch{$('#prepared-margin').textContent='Escribe tu precio final o selecciona un aumento.';}}
function close(){dialog.close();source=null;existingId=null;$('#prepared-form').reset();$('#prepared-model').textContent='';$('#prepared-error').textContent='';}
const selectors={provider:$('#prepared-supplier'),owner:$('#prepared-owner'),model:$('#prepared-model-select'),variant:$('#prepared-variant')};
const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
let choices=[];
const providerKey=row=>row.provider==='other'?'other:'+row.supplier:row.provider;
const ownerKey=row=>row.provider==='samuel'?'samuel':row.ownerId||'unspecified';
const rowKey=row=>row.provider+':'+row.id;
function options(select,placeholder,entries,value=''){
 window.LunivoList.options(select,placeholder,entries);
 select.value=value;if(select.selectedIndex<0)select.value='';select.disabled=entries.length===0;
}
function clearSelection(){
 source=null;existingId=null;revision=null;$('#prepared-model').textContent='';$('#prepared-provider').textContent='';$('#prepared-cost').textContent='';$('#prepared-price').value='';$('#prepared-price').disabled=true;$('#prepared-margin').textContent='';$('#prepared-error').textContent='';$('#prepared-save').disabled=true;
 for(const b of document.querySelectorAll('[data-prepared-increase]')){b.disabled=true;b.setAttribute('aria-pressed','false');}
}
function selectRow(row){
 clearSelection();if(!row)return;
 const data=api.read(),available=latest(row,data);
 if(!available||available.quantity<=0||available.price!==row.price)throw Error('La lista del proveedor cambió. Actualízala y elige de nuevo el equipo.');
 source=structuredClone(row);
 const current=data.inventory.find(i=>i.prepared&&i.preset.id===row.id&&i.preset.provider===row.provider);
 existingId=current?.id||null;revision=current?LunivoSuiteCloud.revision('inventory',current.id):null;
 $('#prepared-title').textContent=current?'Actualizar mi precio':'Preparar mi precio';
 $('#prepared-model').textContent=[row.model,row.capacity,row.color,row.category,row.battery,row.notes].filter(Boolean).join(' · ');
 $('#prepared-provider').textContent='Proveedor: '+row.supplier+(row.provider==='split'&&row.ownerId?' · '+core.ownerName(row.ownerId):'');
 $('#prepared-cost').textContent='Precio base del proveedor: '+money(row.price);
 $('#prepared-price').disabled=false;$('#prepared-price').value=((current?.salePrice??row.price+5000)/100).toFixed(2);
 $('#prepared-save').disabled=false;
 for(const b of document.querySelectorAll('[data-prepared-increase]'))b.disabled=false;
 preview();LunivoSuiteCloud.paint();
}
function cascade(level,row){
 clearSelection();
 const base=choices.filter(o=>providerKey(o)===selectors.provider.value);
 if(level<=0){
  const owners=new Map(base.map(o=>[ownerKey(o),ownerKey(o)==='unspecified'?'Sin dueño especificado':core.ownerName(ownerKey(o))]));
  options(selectors.owner,'Selecciona el dueño',[...owners].sort((a,b)=>collator.compare(a[1],b[1])),row?ownerKey(row):owners.size===1?[...owners.keys()][0]:'');
 }
 const owned=base.filter(o=>ownerKey(o)===selectors.owner.value),models=new Map();
 for(const o of owned)models.set(LunivoProviders.modelKey(o),LunivoProviders.displayModel(o));
 if(level<=1)options(selectors.model,'Selecciona el modelo',[...models].sort((a,b)=>collator.compare(a[1],b[1])),row?LunivoProviders.modelKey(row):models.size===1?[...models.keys()][0]:'');
 const variants=owned.filter(o=>LunivoProviders.modelKey(o)===selectors.model.value).sort((a,b)=>a.price-b.price||collator.compare(a.id,b.id));
 if(level<=2)options(selectors.variant,'Selecciona el equipo y su precio',variants.map(o=>[rowKey(o),[LunivoProviders.specs(o)||o.model,money(o.price),o.quantity+' disponible(s)'].join(' · ')]),row?rowKey(row):variants.length===1?rowKey(variants[0]):'');
 if(selectors.variant.value)selectRow(variants.find(o=>rowKey(o)===selectors.variant.value));
 $('#prepared-selection-status').textContent=!choices.length?'No hay equipos disponibles en la lista de este teléfono. Actualiza el inventario del proveedor.':!selectors.provider.value?'Elige el proveedor para ver sus equipos.':!selectors.owner.value?'Elige de quién es el equipo.':!selectors.model.value?'Selecciona un modelo del inventario.':!variants.length?'No hay variantes disponibles para este modelo.':'Selecciona la variante exacta y define tu precio de venta.';
}
function open(row){
 try{
  if(saving)throw Error('Espera a que termine la operación actual.');
  if(row&&row.quantity<=0)throw Error('El proveedor indica que el equipo está agotado.');
  $('#prepared-form').reset();clearSelection();scope=LunivoStore.account();$('#prepared-title').textContent='Preparar mi precio';
  choices=LunivoProviders.rows(api.read()).filter(o=>o.quantity>0);
  const providers=new Map(choices.map(o=>[providerKey(o),o.provider==='split'?'Split':o.supplier]));
  options(selectors.provider,'Selecciona el proveedor',[...providers].sort((a,b)=>collator.compare(a[1],b[1])),row?providerKey(row):'');
  cascade(0,row);
  dialog.showModal();(row?$('#prepared-price'):selectors.provider).focus();
 }catch(e){api.notice(e.message,'error');}
}
Object.entries(selectors).forEach(([key,select],level)=>select.addEventListener('change',()=>{try{if(scope!==LunivoStore.account())throw Error('La cuenta cambió.');cascade(level);}catch(e){clearSelection();$('#prepared-error').textContent=e.message;}}));
for(const id of ['inventory-prepare','stock-prepare'])$('#'+id).addEventListener('click',()=>open());
for(const b of document.querySelectorAll('[data-prepared-increase]'))b.addEventListener('click',()=>{if(!source)return;$('#prepared-price').value=((source.price+Number(b.dataset.preparedIncrease)*100)/100).toFixed(2);preview();});$('#prepared-price').addEventListener('input',preview);
$('#prepared-form').addEventListener('submit',async event=>{event.preventDefault();if(saving||!source||!event.target.reportValidity())return;const account=scope;try{if(account!==LunivoStore.account())throw Error('La cuenta cambió.');const actor=LunivoProfileUI.current();if(!actor)throw Error('Selecciona tu usuario en Ajustes.');const row=source,targetId=existingId,expectedRevision=revision,model=$('#prepared-model').textContent,price=core.money($('#prepared-price').value),data=api.read(),current=latest(row,data);if(!current||current.quantity<=0)throw Error('El equipo ya no está disponible en la lista del proveedor.');if(current.price!==row.price)throw Error('El precio del proveedor cambió. Cierra y prepara de nuevo el equipo con el precio actualizado.');const preset={id:row.id,provider:row.provider||'other',supplier:row.supplier+(row.provider==='split'&&row.ownerId?' · '+core.ownerName(row.ownerId):''),stockId:row.stockId||''};for(const key of ['brand','capacity','color','category','battery','notes','date'])preset[key]=String(row[key]||'');saving=true;$('#prepared-save').disabled=true;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((row.provider||'other')+'\0'+row.id)),stableId='prepared-'+[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');if(account!==LunivoStore.account())throw Error('La cuenta cambió.');const item={id:targetId||stableId,ownerId:'lunivo',prepared:true,quantity:0,model,brand:row.brand||core.inventoryBrand(row),cost:row.price,salePrice:price,preset,createdBy:actor.id,createdByName:actor.name,createdAt:new Date().toISOString()};if(item.model.length>2000)throw Error('La descripción del proveedor es demasiado larga.');saving=true;$('#prepared-save').disabled=true;const id=item.id;if(targetId){await api.business('organizeStock',{ownerId:'lunivo',brand:item.brand,cost:item.cost,salePrice:price,expectedRevision},id,next=>{const saved=next.inventory.find(i=>i.id===id);if(!saved||!saved.prepared)throw Error('El equipo cambió. Ábrelo de nuevo.');saved.salePrice=price;saved.cost=row.price;return next;});}else await api.business('addStock',{stock:item},id,next=>{if(next.inventory.some(i=>i.id===id))throw Error('Este equipo ya fue preparado. Ábrelo para cambiar su precio.');return {...next,inventory:[...next.inventory,item]};});if(account!==LunivoStore.account())return;close();location.hash='#ventas/inventario?owner=lunivo';api.render();api.notice('Equipo preparado con tu precio de venta.');}catch(e){if(account===LunivoStore.account()&&dialog.open)$('#prepared-error').textContent=['QuotaExceededError','SecurityError'].includes(e.name)?'No se pudo guardar. Se conserva el registro anterior.':e.message;}finally{saving=false;$('#prepared-save').disabled=false;LunivoSuiteCloud.paint();}});
function sell(item,preserve=false){try{const current=latest(item.preset,api.read());if(!current||current.quantity<=0)throw Error('Actualiza el inventario y confirma la disponibilidad del equipo con el proveedor.');api.sell(item,current.price,preserve);if(current.price!==item.cost)api.notice('El costo del proveedor cambió. Se cargó el último costo disponible; revisa tu precio de venta antes de confirmar.','error');}catch(e){api.notice(e.message,'error');}}
for(const id of ['prepared-close','prepared-cancel'])$('#'+id).addEventListener('click',close);dialog.addEventListener('close',()=>{if(!dialog.open){source=null;existingId=null;}});window.addEventListener('hashchange',()=>{if(dialog.open)close();});window.addEventListener('lunivo-cloud',()=>{if(dialog.open&&scope!==LunivoStore.account())close();});window.LunivoPrepared={open,sell,connect(value){api=value;}};
})();
