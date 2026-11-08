'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value/100);
  const nodes={products:$('#products'),count:$('#count'),search:$('#search'),capacity:$('#capacity'),sort:$('#sort'),dialog:$('#details'),variant:$('#variant')};
  let catalog=null, groups=[], brand='all', activeGroup=null, loading=false;
  const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
  const option=(value,label)=>{const item=document.createElement('option');item.value=value;item.textContent=label;return item;};
  function valid(data) {
    if(data?.schemaVersion!==1||data.brand!=='Lunivo'||data.currency!=='USD'||!Number.isFinite(Date.parse(data.updatedAt))||!Array.isArray(data.products)||data.products.length>20000)throw Error('Formato inválido');
    const ids=new Set();
    for(const p of data.products){
      if(!p||typeof p.id!=='string'||!/^[a-f0-9]{20}$/.test(p.id)||ids.has(p.id)||!['Apple','Samsung'].includes(p.manufacturer)||typeof p.model!=='string'||!p.model.length||p.model.length>80||!Number.isSafeInteger(p.priceCents)||p.priceCents<=0||p.available!==true)throw Error('Equipo inválido');
      for(const key of ['capacity','color','condition','grade','battery'])if(typeof p[key]!=='string'||p[key].length>100)throw Error('Detalle inválido');
      if(p.quantity!==undefined&&(!Number.isSafeInteger(p.quantity)||p.quantity<1))throw Error('Existencias inválidas');
      if(p.cycles!==undefined&&p.cycles!==null&&(!Number.isSafeInteger(p.cycles)||p.cycles<0))throw Error('Ciclos inválidos');
      if(p.sim!==undefined&&!['SIM física','Por confirmar'].includes(p.sim))throw Error('SIM inválida');
      if(p.box!==undefined&&p.box!==null&&typeof p.box!=='boolean')throw Error('Caja inválida');
      if(!Array.isArray(p.observations)||p.observations.some(v=>!['Aviso de batería','Aviso de pantalla','Desgaste visible'].includes(v)))throw Error('Observaciones inválidas');
      ids.add(p.id);
    }
    return data;
  }
  function render(){
    const query=nodes.search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matches=groups.map(g=>({...g,variants:g.variants.filter(v=>(nodes.capacity.value==='all'||v.capacity===nodes.capacity.value)&&`${v.model} ${v.manufacturer} ${v.capacity} ${v.color}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))})).filter(g=>(brand==='all'||g.manufacturer===brand)&&g.variants.length);
    const lowest=g=>Math.min(...g.variants.map(v=>v.priceCents));
    matches.sort((a,b)=>nodes.sort.value==='low'?lowest(a)-lowest(b)||collator.compare(a.model,b.model):nodes.sort.value==='high'?lowest(b)-lowest(a)||collator.compare(a.model,b.model):collator.compare(a.model,b.model));
    const fragment=document.createDocumentFragment();
    const stale=Date.now()-Date.parse(catalog.updatedAt)>2*60*60*1000;
    for(const group of matches){
      const card=$('#card').content.firstElementChild.cloneNode(true);
      card.classList.toggle('samsung',group.manufacturer==='Samsung');
      card.querySelector('.manufacturer').textContent=group.manufacturer==='Apple'?'iPhone · Lunivo':'Samsung · Lunivo';
      card.querySelector('h3').textContent=group.model;
      const capacities=[...new Set(group.variants.map(v=>v.capacity))].sort(collator.compare);
      card.querySelector('.summary').textContent=capacities.join(' · ');
      const prices=group.variants.map(v=>v.priceCents);
      card.querySelector('.from').textContent=new Set(prices).size>1?'Desde':'Precio de venta';
      card.querySelector('.price').textContent=money(Math.min(...prices));
      const units=group.variants.every(v=>Number.isSafeInteger(v.quantity))?group.variants.reduce((n,v)=>n+v.quantity,0):null;
      card.querySelector('.availability').textContent=stale?'Consultar stock':units===null?'● Disponible':`${units} disponible${units===1?'':'s'}`;
      const button=card.querySelector('button');
      button.setAttribute('aria-label',`Ver opciones de ${group.model}`);
      button.addEventListener('click',()=>openDetails(group));
      fragment.append(card);
    }
    nodes.products.replaceChildren(fragment);
    const units=matches.flatMap(g=>g.variants).reduce((n,v)=>n+(v.quantity||0),0);
    nodes.count.textContent=`${matches.length} ${matches.length===1?'modelo':'modelos'}${units?' · '+units+' equipos':''}`;
    $('#empty').hidden=matches.length!==0;
  }
  function showVariant(){
    const p=activeGroup?.variants.find(v=>v.id===nodes.variant.value);
    if(!p)return;
    const specs=[['Capacidad',p.capacity],['Color',p.color],['Estado',p.condition],['Batería',p.battery||'Por confirmar']];
    if(p.grade)specs.push(['Categoría',p.grade]);
    if(Number.isSafeInteger(p.quantity))specs.push(['Disponibles',String(p.quantity)]);
    if(p.cycles!==null&&p.cycles!==undefined)specs.push(['Ciclos de batería',String(p.cycles)]);
    if(p.sim==='SIM física')specs.push(['Tipo de SIM',p.sim]);
    if(typeof p.box==='boolean')specs.push(['Caja',p.box?'Incluida':'Sin caja']);
    if(p.observations.length)specs.push(['A tener en cuenta',p.observations.join(' · ')]);
    const fragment=document.createDocumentFragment();
    for(const [name,value]of specs){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);fragment.append(row);}
    $('#specs').replaceChildren(fragment);
    $('#detail-price').textContent=money(p.priceCents);
    const text=`Hola Lunivo, me interesa el ${p.model}, ${p.capacity}, color ${p.color}. Precio publicado: ${money(p.priceCents)}. Estado: ${p.condition}${p.grade?`, categoría ${p.grade}`:''}${p.battery?`, batería ${p.battery}`:''}${p.cycles!==null&&p.cycles!==undefined?`, ${p.cycles} ciclos`:''}${p.sim==='SIM física'?', SIM física':''}${typeof p.box==='boolean'?(p.box?', con caja':', sin caja'):''}${p.observations.length?`. Observaciones: ${p.observations.join(', ')}`:''}. ¿Está disponible?`;
    $('#consult').href='https://wa.me/50376241930?text='+encodeURIComponent(text);
  }
  function openDetails(group){
    activeGroup=group;
    $('#detail-title').textContent=group.model;
    const sorted=[...group.variants].sort((a,b)=>a.priceCents-b.priceCents||collator.compare(a.capacity,b.capacity));
    nodes.variant.replaceChildren(...sorted.map(v=>option(v.id,[v.capacity,v.color,v.condition,v.grade?`Categoría ${v.grade}`:'',v.battery?`Bat. ${v.battery}`:'',v.cycles!==null&&v.cycles!==undefined?`${v.cycles} ciclos`:'',v.sim==='SIM física'?v.sim:'',typeof v.box==='boolean'?(v.box?'Con caja':'Sin caja'):'',...v.observations,money(v.priceCents),v.quantity?`${v.quantity} disponibles`:''].filter(Boolean).join(' · '))));
    showVariant();
    nodes.dialog.showModal();
  }
  async function load(background=false){
    if(loading||background&&nodes.dialog.open)return;loading=true;
    const previous=catalog;
    const previousCapacity=nodes.capacity.value;
    nodes.products.setAttribute('aria-busy','true');$('#error').hidden=true;$('#empty').hidden=true;$('#notice').hidden=true;
    if(!background){nodes.count.textContent='Cargando modelos…';$('#updated').textContent='Consultando catálogo…';}
    try{
      const response=await fetch('inventory.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('No disponible');
      catalog=valid(await response.json());
      const map=new Map();
      for(const p of catalog.products){const key=p.manufacturer+'|'+p.model;if(!map.has(key))map.set(key,{model:p.model,manufacturer:p.manufacturer,variants:[]});map.get(key).variants.push(p);}
      groups=[...map.values()];
      nodes.capacity.replaceChildren(option('all','Toda capacidad'),...[...new Set(catalog.products.map(v=>v.capacity))].sort(collator.compare).map(c=>option(c,c)));
      if([...nodes.capacity.options].some(o=>o.value===previousCapacity))nodes.capacity.value=previousCapacity;
      $('#updated').textContent='Inventario actualizado: '+new Intl.DateTimeFormat('es-SV',{dateStyle:'medium',timeStyle:'short',timeZone:'America/El_Salvador'}).format(new Date(catalog.updatedAt))+' · El Salvador';
      if(Date.now()-Date.parse(catalog.updatedAt)>2*60*60*1000){$('#notice').textContent='Esta lista lleva más de dos horas sin actualizarse. Consulta por WhatsApp para confirmar el precio y la disponibilidad de tu equipo.';$('#notice').hidden=false;}
      render();
    }catch{
      if(background&&previous){catalog=previous;render();$('#notice').textContent='No pudimos comprobar la última actualización. Se conserva la lista anterior; confirma disponibilidad por WhatsApp.';$('#notice').hidden=false;return;}
      catalog=null;groups=[];nodes.products.replaceChildren();nodes.count.textContent='Inventario no disponible';$('#updated').textContent='No se pudo consultar la lista';$('#error').hidden=false;
    }finally{loading=false;nodes.products.setAttribute('aria-busy','false');}
  }
  $('#filters').addEventListener('submit',event=>event.preventDefault());
  nodes.search.addEventListener('input',()=>{if(catalog)render();});
  nodes.capacity.addEventListener('change',()=>{if(catalog)render();});
  nodes.sort.addEventListener('change',()=>{if(catalog)render();});
  document.querySelectorAll('[data-brand]').forEach(button=>button.addEventListener('click',()=>{brand=button.dataset.brand;document.querySelectorAll('[data-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(catalog)render();}));
  $('#reset').addEventListener('click',()=>{brand='all';nodes.search.value='';nodes.capacity.value='all';nodes.sort.value='model';document.querySelectorAll('[data-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brand==='all')));if(catalog)render();nodes.search.focus();});
  nodes.variant.addEventListener('change',showVariant);
  $('#close').addEventListener('click',()=>nodes.dialog.close());
  nodes.dialog.addEventListener('click',event=>{if(event.target!==nodes.dialog)return;const r=nodes.dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)nodes.dialog.close();});
  $('#retry').addEventListener('click',()=>load());
  setInterval(()=>{if(document.visibilityState==='visible')load(true);},5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(true);});
  load();
})();
