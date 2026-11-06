(()=>{
'use strict';
const $=s=>document.querySelector(s),core=window.LunivoSalesCore;
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const currencyFormat=new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}),money=n=>currencyFormat.format(n/100);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d)\s+(gb|tb)\b/g,'$1$2').replace(/\s+/g,' ').trim();
const details=o=>[o.model,o.capacity,o.color,o.category,o.battery,o.notes].filter(Boolean).join(' · ');
let api=null,family='',rowCount=0;
function modelKey(o){
 // Group by model for browsing only. Capacity, condition and price remain separate rows.
 let name=normalize(o.model.split(' · ')[0]);if(name.includes('iphone'))name=name.replace(/\bnormal\b/g,'');return name.replace(/\b(?:apple|samsung|galaxy)\b/g,'').replace(/\b\d+\s*(?:gb|tb|ram)\b/g,'').replace(/[-–—|]/g,' ').replace(/\s+/g,' ').trim();
}
function displayModel(o){let value=o.model.split(' · ')[0];if(o.capacity)value=value.replace(/\b\d+\s*(?:GB|TB)\b/gi,'');if(/iphone/i.test(value))value=value.replace(/\bnormal\b/gi,'');value=value.replace(/\b\d+\s*RAM\b/gi,'').trim().replace(/[-–—|]+$/g,'').replace(/\s+/g,' ').trim();if(value===value.toUpperCase())value=value.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());return value.replace(/\biphone\b/gi,'iPhone').replace(/\bIphone Se\b/gi,'iPhone SE');}
function specs(o){const seen=new Set();return[o.capacity,o.color,o.category,o.battery?'Batería '+o.battery:'',o.notes].filter(Boolean).flatMap(value=>value.split(' · ')).filter(value=>{const key=normalize(value).replace(/\s/g,'');if(!key||seen.has(key))return false;seen.add(key);return true;}).join(' · ');}
function rows(data){
 return [...data.offers.map(o=>({...o,provider:core.providerForOffer(o),supplier:core.supplierName(o)})),
 ...data.inventory.filter(item=>core.providerForOwner(item.ownerId)&&!data.providerFeeds?.[core.providerForOwner(item.ownerId)]).map(item=>({id:'provider-stock:'+item.id,stockId:item.id,ownerId:item.ownerId,provider:core.providerForOwner(item.ownerId),supplier:core.providerForOwner(item.ownerId)==='split'?'Split':'Samuel',model:item.model,price:item.cost,quantity:item.quantity,source:'stock',stock:item}))];
}
function link(choice,active){
 const a=el('a',undefined,'provider-card');a.href=choice.url;a.dataset.inventoryProvider=choice.id;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#'+choice.icon);svg.append(use);
 const copy=el('span');copy.append(el('strong',choice.name));if(Number.isInteger(choice.count)){copy.append(el('span',String(choice.count),'provider-tab-count'));a.setAttribute('aria-label',choice.name+', '+choice.count+' equipos');}else copy.append(el('small',choice.sub||''));a.append(svg,copy,el('span','→','provider-arrow'));if(active)a.setAttribute('aria-current','page');
 a.addEventListener('click',()=>{$('#offer-variant').value='';});return a;
}
function shortcuts(data){
 const params=new URLSearchParams(location.hash.split('?')[1]||''),current=location.hash.startsWith('#ventas/proveedores')?core.providerFilter(params.get('provider')):'';
 for(const id of['inventory-owner-shortcuts','inventory-provider-cards','provider-directory']){
  const target=$('#'+id);target.replaceChildren();target.classList.add('provider-cards');target.classList.toggle('provider-cards-compact',id==='provider-directory');target.classList.toggle('provider-access',id!=='provider-directory');
  const available=rows(data);const choices=id==='provider-directory'?[{id:'',name:'Todos',icon:'icon-compare',url:'#ventas/proveedores'},{id:'samuel',name:'Samuel',icon:'icon-phone',url:'#ventas/proveedores?provider=samuel'},{id:'split',name:'Split',icon:'icon-inventory',url:'#ventas/proveedores?provider=split'}].map(choice=>({...choice,count:available.filter(o=>!choice.id||o.provider===choice.id).reduce((n,o)=>n+o.quantity,0)})):[{id:'all',name:'Inventario',icon:'icon-inventory',url:'#ventas/proveedores',sub:'Equipos disponibles de Samuel y Split'}];
  for(const choice of choices)target.append(link(choice,id==='provider-directory'&&choice.id===current));
 }
}
function button(text,handler){const b=el('button',text,'secondary');b.type='button';b.addEventListener('click',handler);return b;}
function render(data){
 const params=new URLSearchParams(location.hash.split('?')[1]||''),onPage=location.hash.startsWith('#ventas/proveedores');
 const provider=onPage?core.providerFilter(params.get('provider')):'';
 const owner=provider==='split'&&core.SPLIT_OWNERS.includes(params.get('owner'))?params.get('owner'):'';
 $('#sales-providers').classList.add('unified-providers');
 $('#provider-catalog-title').textContent='Inventarios';
 $('#provider-catalog-description').textContent='Compara precios por unidad. Revisa capacidad, estado y batería.';
 $('#provider-all-link').hidden=true;
 const ownFilters=$('#provider-owner-filters');ownFilters.replaceChildren();ownFilters.hidden=provider!=='split';
 if(provider==='split')for(const choice of[{id:'',name:'Combinado'},...core.OWNERS.filter(o=>core.SPLIT_OWNERS.includes(o.id))]){
  const b=button(choice.id?choice.name:'Todo Split',()=>{const query=new URLSearchParams({provider:'split'});if(choice.id)query.set('owner',choice.id);location.hash='#ventas/proveedores?'+query;});b.dataset.providerOwner=choice.id;b.setAttribute('aria-pressed',String(choice.id===owner));ownFilters.append(b);
 }
 const all=rows(data);rowCount=all.length;const model=$('#provider-model'),oldModel=model.value,models=new Map();
 for(const row of all){const key=modelKey(row);if(key&&!models.has(key))models.set(key,row.model.split(' · ')[0]);}
 window.LunivoList.options(model,'Todos los modelos',[...models].sort((a,b)=>a[1].localeCompare(b[1],'es',{numeric:true})));model.value=oldModel;if(model.selectedIndex<0)model.value='';
 const base=all.filter(o=>(!provider||o.provider===provider)&&(!owner||o.ownerId===owner));
 const variant=$('#offer-variant'),oldVariant=variant.value,variants=new Map();for(const row of base)variants.set(core.variant(row),details(row));
 window.LunivoList.options(variant,'Todas las variantes',[...variants]);variant.value=oldVariant;if(variant.selectedIndex<0)variant.value='';
 const filterCount=Number(Boolean(model.value))+Number(Boolean(variant.value))+Number($('#provider-available').checked)+Number($('#offer-sort').value!=='price');$('#provider-more-filters>summary').textContent='Más opciones'+(filterCount?' · '+filterCount+' filtro(s)':'');
 const query=normalize($('#offer-search').value).split(' ').filter(Boolean);
 for(const b of document.querySelectorAll('[data-provider-family]'))b.setAttribute('aria-pressed',String(b.dataset.providerFamily===family));
 const filtered=base.filter(o=>(!family||core.phoneFamily(o)===family)&&(!model.value||modelKey(o)===model.value)&&(!variant.value||core.variant(o)===variant.value)&&(!$('#provider-available').checked||o.quantity>0)&&query.every(term=>normalize(details(o)+' '+o.supplier+' '+core.ownerName(o.ownerId)).includes(term)));
 filtered.sort((a,b)=>($('#offer-sort').value==='price'?a.price-b.price:details(a).localeCompare(details(b),'es',{numeric:true}))||details(a).localeCompare(details(b),'es',{numeric:true})||a.supplier.localeCompare(b.supplier,'es')||a.id.localeCompare(b.id));
 const units=filtered.reduce((n,o)=>n+o.quantity,0);$('#provider-results').textContent=units+' equipo'+(units===1?' disponible':'s disponibles')+(owner?' · '+core.ownerName(owner):provider==='samuel'?' · Samuel':provider==='split'?' · Split':'');
 const list=$('#offers-list'),openId=list.querySelector('[open]')?.dataset.offerId;list.replaceChildren();
 if(!filtered.length)list.append(el('p','No hay equipos con esta búsqueda. Prueba otro modelo o quita los filtros en Más opciones.','empty'));
 const count=window.LunivoList.limit(list,[location.hash,$('#offer-search').value,model.value,variant.value,family,$('#provider-available').checked,$('#offer-sort').value].join('|'));
 for(const o of filtered.slice(0,count)){
  const row=el('details',undefined,'suite-offer compact-device-card');row.dataset.offerId=o.id;row.dataset.provider=o.provider;if(o.stockId)row.dataset.providerStockId=o.stockId;row.open=o.id===openId;
  const parts=o.model.split(' · '),isStock=Boolean(o.stockId),splitOwner=o.provider==='split'&&['saul','javier'].includes(o.ownerId),summary=window.LunivoInventory.cardSummary({model:displayModel(o),description:isStock?[core.inventoryBrand(o.stock),...parts.slice(1)].join(' · '):specs(o),ownerName:isStock||splitOwner?core.ownerName(o.ownerId):o.supplier,ownerLabel:isStock||splitOwner?o.supplier+' · Dueño':'Proveedor',quantity:o.quantity,amount:o.price,priceLabel:isStock?'Costo':'Precio'});
  const ownerText=splitOwner?'Split · '+core.ownerName(o.ownerId):o.supplier;summary.querySelector('.device-card-owner').textContent=ownerText;summary.querySelector('.device-card-owner').setAttribute('aria-label','Proveedor: '+o.supplier+(o.ownerId?' · Dueño: '+core.ownerName(o.ownerId):''));summary.querySelector('.device-card-units').remove();summary.querySelector('.device-card-status').textContent=o.quantity>0?o.quantity+' disponible'+(o.quantity===1?'':'s'):'Agotado';
  const body=el('div',undefined,'device-card-body');body.append(el('p',details(o),'device-card-full-model'),el('p',(isStock?'Costo: ':'Precio: ')+money(o.price)+' / unidad'),el('p',isStock?o.supplier+' · Dueño: '+core.ownerName(o.ownerId)+' · '+o.quantity+' disponible(s)':o.quantity+' disponible(s) · Lista '+o.date+' · '+(o.source==='feed'?'Inventario del proveedor':o.source==='pdf'?'PDF anterior · Referencia':'Cotización manual')));
  const actions=el('div',undefined,'actions'),sell=button('Usar en venta',()=>isStock?api.sellStock(o.stock):api.sellOffer(o));sell.disabled=o.quantity===0;actions.append(sell);const prepare=button('Preparar con mi precio',()=>api.prepare(o));prepare.disabled=o.quantity===0;actions.append(prepare);
  if(isStock){const manage=el('a','Administrar inventario de '+core.ownerName(o.ownerId),'text-link');manage.href='#ventas/inventario?provider='+o.provider+'&owner='+o.ownerId;actions.append(manage);}
  else actions.append(button('Añadir alternativa',()=>api.alternative(o)));
  body.append(actions);row.append(summary,body);window.LunivoInventory.accordion(row,list);list.append(row);
 }
 window.LunivoList.more(list,filtered.length,()=>render(api.read()));
 $('#catalog-load').hidden=Boolean(data.providerFeeds?.samuel);$('#catalog-source').hidden=Boolean(data.providerFeeds?.samuel||data.providerFeeds?.split);
 $('#catalog-source').textContent='Samuel: hoja de cálculo · Split: Saúl y Javier. Precios y disponibilidad del proveedor en la última consulta. Confirma las existencias antes de vender.';
 shortcuts(data);
}
for(const id of['offer-search','offer-variant','provider-model','offer-sort','provider-available'])$('#'+id).addEventListener(id==='offer-search'?'input':'change',()=>{try{if(id==='offer-search'&&rowCount>60){window.LunivoList.schedule('provider-search',()=>{$('#offer-variant').value='';render(api.read());});return;}if(['provider-model','offer-variant'].includes(id)&&$('#'+id).value)family='';if(['offer-search','provider-model'].includes(id))$('#offer-variant').value='';render(api.read());}catch(e){api.notice(api.errorText(e),'error');}});
for(const b of document.querySelectorAll('[data-provider-family]'))b.addEventListener('click',()=>{family=b.dataset.providerFamily;$('#provider-model').value='';$('#offer-variant').value='';render(api.read());});
$('#provider-clear-filters').addEventListener('click',()=>{family='';$('#offer-search').value='';$('#provider-model').value='';$('#offer-variant').value='';$('#provider-available').checked=false;$('#offer-sort').value='price';render(api.read());});
window.LunivoProviders={rows,modelKey,displayModel,specs,connect(value){api=value;},render,shortcuts,reset(){family='';$('#offer-search').value='';$('#provider-model').replaceChildren(new Option('Todos los modelos',''));$('#offer-variant').replaceChildren(new Option('Todas las variantes',''));$('#offer-sort').value='price';$('#provider-available').checked=false;$('#provider-more-filters').open=false;$('#offers-list').replaceChildren();$('#provider-owner-filters').replaceChildren();$('#provider-results').textContent='';}};
})();
