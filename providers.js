(()=>{
'use strict';
const $=s=>document.querySelector(s),core=window.LunivoSalesCore;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const money=n=>new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(n/100);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)\s+(gb|tb)\b/g,'$1$2').replace(/\s+/g,' ').trim();
const details=o=>[o.model,o.capacity,o.color,o.category,o.battery,o.notes].filter(Boolean).join(' · ');
let api=null;
function modelKey(o){
 // Group by model for browsing only. Capacity, condition and price remain separate rows.
 return normalize(o.model.split(' · ')[0]).replace(/\b(?:apple|samsung|galaxy)\b/g,'').replace(/\b\d+\s*(?:gb|tb)\b/g,'').replace(/\s+/g,' ').trim();
}
function rows(data){
 return [...data.offers.map(o=>({...o,provider:core.isTecnoShop(o)?'tecnoshop':/^split(?:\b|$)/i.test(o.supplier)?'split':'other'})),
 ...data.inventory.filter(core.inSplit).map(item=>({id:'split-stock:'+item.id,stockId:item.id,ownerId:item.ownerId,provider:'split',supplier:'Split',model:item.model,price:item.cost,quantity:item.quantity,source:'stock',stock:item}))];
}
function link(choice,active){
 const a=el('a',undefined,'provider-card');a.href=choice.url;a.dataset.inventoryProvider=choice.id;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#'+choice.icon);svg.append(use);
 const copy=el('span');copy.append(el('strong',choice.name),el('small',choice.sub||''));a.append(svg,copy,el('span','→','provider-arrow'));if(active)a.setAttribute('aria-current','page');
 a.addEventListener('click',()=>{$('#offer-variant').value='';});return a;
}
function shortcuts(){
 const params=new URLSearchParams(location.hash.split('?')[1]||''),current=location.hash.startsWith('#ventas/proveedores')?params.get('provider')||'':'';
 for(const id of['inventory-owner-shortcuts','inventory-provider-cards','provider-directory']){
  const target=$('#'+id);target.replaceChildren();target.classList.add('provider-cards');target.classList.toggle('provider-cards-compact',id==='provider-directory');target.classList.toggle('provider-access',id!=='provider-directory');
  const choices=id==='provider-directory'?[{id:'',name:'Todos',icon:'icon-compare',url:'#ventas/proveedores'},{id:'split',name:'Split',icon:'icon-inventory',url:'#ventas/proveedores?provider=split'},{id:'tecnoshop',name:'TecnoShop',icon:'icon-phone',url:'#ventas/proveedores?provider=tecnoshop'}]:[{id:'all',name:'Proveedores',icon:'icon-compare',url:'#ventas/proveedores',sub:'Split y TecnoShop · Consulta y compara precios'}];
  for(const choice of choices)target.append(link(choice,id==='provider-directory'&&choice.id===current));
 }
}
function button(text,handler){const b=el('button',text,'secondary');b.type='button';b.addEventListener('click',handler);return b;}
function render(data){
 const params=new URLSearchParams(location.hash.split('?')[1]||''),onPage=location.hash.startsWith('#ventas/proveedores');
 const provider=onPage&&['split','tecnoshop'].includes(params.get('provider'))?params.get('provider'):'';
 const owner=provider==='split'&&core.SPLIT_OWNERS.includes(params.get('owner'))?params.get('owner'):'';
 $('#sales-providers').classList.add('unified-providers');
 $('#provider-catalog-title').textContent='Inventarios de proveedores';
 $('#provider-catalog-description').textContent='Busca un modelo y compara el costo de Split con el precio de TecnoShop. Revisa capacidad, estado y batería antes de elegir.';
 $('#provider-all-link').hidden=!provider;
 const ownFilters=$('#provider-owner-filters');ownFilters.replaceChildren();ownFilters.hidden=provider!=='split';
 if(provider==='split')for(const choice of[{id:'',name:'Combinado'},...core.OWNERS.filter(o=>core.SPLIT_OWNERS.includes(o.id))]){
  const b=button(choice.name,()=>{const query=new URLSearchParams({provider:'split'});if(choice.id)query.set('owner',choice.id);location.hash='#ventas/proveedores?'+query;});b.dataset.providerOwner=choice.id;b.setAttribute('aria-pressed',String(choice.id===owner));ownFilters.append(b);
 }
 const all=rows(data),model=$('#provider-model'),oldModel=model.value,models=new Map();
 for(const row of all){const key=modelKey(row);if(key&&!models.has(key))models.set(key,row.model.split(' · ')[0]);}
 model.replaceChildren(new Option('Todos los modelos',''));for(const[key,label]of[...models].sort((a,b)=>a[1].localeCompare(b[1],'es',{numeric:true})))model.add(new Option(label,key));model.value=oldModel;if(model.selectedIndex<0)model.value='';
 const base=all.filter(o=>(!provider||o.provider===provider)&&(!owner||o.ownerId===owner));
 const variant=$('#offer-variant'),oldVariant=variant.value,variants=new Map();for(const row of base)variants.set(core.variant(row),details(row));
 variant.replaceChildren(new Option('Todas las variantes',''));for(const[key,label]of variants)variant.add(new Option(label,key));variant.value=oldVariant;if(variant.selectedIndex<0)variant.value='';
 $('#provider-more-filters>summary').textContent='Más filtros'+(variant.value?' · Variante seleccionada':'')+($('#provider-available').checked?' · Solo disponibles':'');
 const query=normalize($('#offer-search').value).split(' ').filter(Boolean);
 const filtered=base.filter(o=>(!model.value||modelKey(o)===model.value)&&(!variant.value||core.variant(o)===variant.value)&&(!$('#provider-available').checked||o.quantity>0)&&query.every(term=>normalize(details(o)+' '+o.supplier+' '+core.ownerName(o.ownerId)).includes(term)));
 filtered.sort((a,b)=>($('#offer-sort').value==='price'?a.price-b.price:details(a).localeCompare(details(b),'es',{numeric:true}))||details(a).localeCompare(details(b),'es',{numeric:true})||a.supplier.localeCompare(b.supplier,'es')||a.id.localeCompare(b.id));
 $('#provider-results').textContent=filtered.length+' opción(es) · '+(provider==='split'?'Split'+(owner?' · '+core.ownerName(owner):' · Samuel + Javier'):provider==='tecnoshop'?'TecnoShop':'Todos los proveedores')+' · '+($('#offer-sort').value==='price'?'Menor importe primero':'Orden por modelo');
 const list=$('#offers-list'),openId=list.querySelector('[open]')?.dataset.offerId;list.replaceChildren();
 if(!filtered.length)list.append(el('p','No hay equipos con estos filtros. Puedes cargar la lista de TecnoShop o añadir una oferta.','empty'));
 for(const o of filtered){
  const row=el('details',undefined,'suite-offer compact-device-card');row.dataset.offerId=o.id;row.dataset.provider=o.provider;if(o.stockId)row.dataset.providerStockId=o.stockId;row.open=o.id===openId;
  const parts=o.model.split(' · '),isStock=Boolean(o.stockId),summary=window.LunivoInventory.cardSummary({model:isStock?parts[0]:o.model,description:isStock?[core.inventoryBrand(o.stock),...parts.slice(1)].join(' · '):[o.capacity,o.color,o.category,o.battery,o.notes].filter(Boolean).join(' · '),ownerName:isStock?core.ownerName(o.ownerId):o.supplier,ownerLabel:isStock?'Split · Dueño':'Proveedor',quantity:o.quantity,amount:o.price,priceLabel:isStock?'Costo':'Precio'});
  const body=el('div',undefined,'device-card-body');body.append(el('p',details(o),'device-card-full-model'),el('p',(isStock?'Costo: ':'Precio: ')+money(o.price)+' / unidad'),el('p',isStock?'Split · Dueño: '+core.ownerName(o.ownerId)+' · '+o.quantity+' disponible(s)':o.quantity+' disponible(s) · Lista '+o.date+' · '+(o.source==='pdf'?'PDF de referencia':'Cotización manual')));
  const actions=el('div',undefined,'actions'),sell=button('Usar en venta',()=>isStock?api.sellStock(o.stock):api.sellOffer(o));sell.disabled=o.quantity===0;actions.append(sell);
  if(isStock){const manage=el('a','Administrar inventario de '+core.ownerName(o.ownerId),'text-link');manage.href='#ventas/inventario?provider=split&owner='+o.ownerId;actions.append(manage);}
  else actions.append(button('Añadir alternativa',()=>api.alternative(o)));
  body.append(actions);row.append(summary,body);window.LunivoInventory.accordion(row,list);list.append(row);
 }
 $('#catalog-source').textContent=data.offers.some(o=>o.source==='pdf')?'TecnoShopSV · Lista del 02/11/2026. Confirma su disponibilidad. Split muestra los equipos registrados de Samuel y Javier.':'Split muestra los equipos registrados. Carga la lista TecnoShopSV del 02/11/2026 para comparar ambos proveedores.';
 shortcuts();
}
for(const id of['offer-search','offer-variant','provider-model','offer-sort','provider-available'])$('#'+id).addEventListener(id==='offer-search'?'input':'change',()=>{try{if(['offer-search','provider-model'].includes(id))$('#offer-variant').value='';render(api.read());}catch(e){api.notice(api.errorText(e),'error');}});
window.LunivoProviders={connect(value){api=value;},render,shortcuts,reset(){$('#offer-search').value='';$('#provider-model').replaceChildren(new Option('Todos los modelos',''));$('#offer-variant').replaceChildren(new Option('Todas las variantes',''));$('#offer-sort').value='price';$('#provider-available').checked=false;$('#provider-more-filters').open=false;$('#offers-list').replaceChildren();$('#provider-owner-filters').replaceChildren();$('#provider-results').textContent='';}};
})();
