'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value/100);
  const nodes={products:$('#products'),count:$('#count'),search:$('#search'),capacity:$('#capacity'),sort:$('#sort'),dialog:$('#details'),variant:$('#variant')};
  let catalog=null, groups=[], brand='all', activeGroup=null, loading=false;
  let images={};
  const selectedColors=new Map();
  // Apply 10% and round once to the nearest whole dollar (half rounds up).
  const regularPrice=cents=>Number((BigInt(cents)*11n+500n)/1000n)*100;
  let banks=[];
  const plansReady=fetch('payment-plans.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)}).then(async response=>{
    if(!response.ok)throw Error('Planes no disponibles');
    const data=await response.json();
    if(!Array.isArray(data.banks)||data.banks.length!==5)throw Error('Bancos inválidos');
    const ids=new Set();
    for(const bank of data.banks){
      if(!bank||!['agricola','bac','promerica','davivienda','cuscatlan'].includes(bank.id)||ids.has(bank.id)||typeof bank.name!=='string'||!bank.name.length||bank.name.length>60||!Array.isArray(bank.installments)||bank.installments.some(n=>!Number.isInteger(n)||n<1||n>60)||new Set(bank.installments).size!==bank.installments.length)throw Error('Cuotas inválidas');
      ids.add(bank.id);
    }
    banks=data.banks;
  }).catch(()=>{});
  const imagesReady=fetch('product-images.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)}).then(async r=>{
    if(!r.ok)return;
    const data=await r.json();
    if(data.version!==2)return;
    for(const [key,item]of Object.entries(data.products||{})){
      if(key===item.model+'|'+item.color&&typeof item.color==='string'&&/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(item.path))images[key]=item;
    }
  }).catch(()=>{});
  const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
  const batteryText=p=>p.manufacturer==='Samsung'?'en excelentes condiciones':(p.battery||'en excelente estado');
  const option=(value,label)=>{const item=document.createElement('option');item.value=value;item.textContent=label;return item;};
  function valid(data) {
    if(data?.schemaVersion!==1||data.brand!=='Lunivo'||data.currency!=='USD'||!Number.isFinite(Date.parse(data.updatedAt))||!Array.isArray(data.products)||data.products.length>20000)throw Error('Formato inválido');
    const ids=new Set();
    for(const p of data.products){
      if(!p||typeof p.id!=='string'||!/^[a-f0-9]{20}$/.test(p.id)||ids.has(p.id)||!['Apple','Samsung'].includes(p.manufacturer)||typeof p.model!=='string'||!p.model.length||p.model.length>80||!Number.isSafeInteger(p.priceCents)||p.priceCents<=0||!Number.isSafeInteger(regularPrice(p.priceCents))||p.available!==true)throw Error('Equipo inválido');
      for(const key of ['capacity','color','condition','grade','battery'])if(typeof p[key]!=='string'||p[key].length>100)throw Error('Detalle inválido');
      if(p.quantity!==undefined&&(!Number.isSafeInteger(p.quantity)||p.quantity<1))throw Error('Existencias inválidas');
      if(p.cycles!==undefined&&p.cycles!==null&&(!Number.isSafeInteger(p.cycles)||p.cycles<0))throw Error('Ciclos inválidos');
      if(p.sim!==undefined&&!['SIM física','SIM física y eSIM','eSIM','Por confirmar'].includes(p.sim))throw Error('SIM inválida');
      if(p.box!==undefined&&p.box!==null&&typeof p.box!=='boolean')throw Error('Caja inválida');
      if(!Array.isArray(p.observations)||p.observations.some(v=>!['Aviso de batería','Aviso de pantalla','Aviso de cámara','Aviso de TrueDepth','Aviso de Face ID','Desgaste visible','Burbujas en pantalla','Puntos negros en pantalla','Pantalla reemplazada','Cable incluido'].includes(v)))throw Error('Observaciones inválidas');
      if(p.condition==='Estado por confirmar')p.condition='Seminuevo';
      if(p.ram!==undefined&&p.ram!==''&&!/^(?:[1-9]|[1-9][0-9]) GB$/.test(p.ram))throw Error('RAM inválida');
      ids.add(p.id);
    }
    return data;
  }
  function framePhoto(image,picture){
    const original={x:0,y:0,width:picture.width,height:picture.height};
    const frame=picture.framing||original;
    if(![frame.x,frame.y,frame.width,frame.height,picture.width,picture.height].every(Number.isFinite)||frame.width<=0||frame.height<=0||frame.x<0||frame.y<0||frame.x+frame.width>picture.width||frame.y+frame.height>picture.height)return;
    image.parentElement.style.aspectRatio=frame.width+'/'+frame.height;
    image.parentElement.style.setProperty('--photo-ratio',String(frame.width/frame.height));
    image.style.width=(picture.width/frame.width*100)+'%';image.style.height=(picture.height/frame.height*100)+'%';
    image.style.left=(-frame.x/frame.width*100)+'%';image.style.top=(-frame.y/frame.height*100)+'%';
  }
  function paintHero(data){
    const stage=$('.hero-collection');
    if(!stage)return;
    const featured={Apple:{model:'iPhone 18 Pro Max',color:'Borgoña',label:'Burgundy'},Samsung:{model:'Samsung S26 Ultra',color:'Celeste',label:'Celeste'}};
    function updateCount(){const count=stage.querySelectorAll('figure:not([hidden])').length;stage.dataset.count=String(count);$('#hero-signature').hidden=count>0;}
    for(const manufacturer of ['Samsung','Apple']){
      const figure=stage.querySelector('[data-hero-brand="'+manufacturer+'"]');
      const feature=featured[manufacturer],key=feature.model+'|'+feature.color,picture=images[key];
      const available=data.products.some(p=>p.manufacturer===manufacturer&&p.available);
      const selected=data.products.find(p=>p.manufacturer===manufacturer&&p.available&&p.model===feature.model&&p.color===feature.color);
      delete figure.dataset.productId;
      figure.hidden=!available||!picture;
      if(figure.hidden)continue;
      const image=figure.querySelector('img');
      framePhoto(image,picture);image.src=picture.path+'?v='+picture.sha256.slice(0,12);image.alt=feature.model+', '+feature.color+' · imagen oficial de referencia';
      figure.dataset.featuredModel=feature.model;figure.dataset.featuredColor=feature.color;
      figure.dataset.reference=String(!selected);
      if(selected)figure.dataset.productId=selected.id;
      figure.querySelector('strong').textContent=feature.model.replace(/^Samsung /,'');
      figure.querySelector('small').textContent=feature.label;
      image.onerror=()=>{figure.hidden=true;updateCount();};
    }
    updateCount();
  }
  const colorPalette={Blanco:'#f3f3ed',Negro:'#282b30',Morado:'#8e80ae',Lila:'#c4b6dc',Verde:'#799582',Dorado:'#dbc59d',Azul:'#5075a3',Rojo:'#b73e49',Celeste:'#b9dce9',Amarillo:'#f1db8e',Rosado:'#e7bfd0',Gris:'#8d9093',Plata:'#cdd0d4',Anaranjado:'#de8546',Borgoña:'#79444f',Glaciar:'#d5e8ed','Titanio natural':'#b6afa4','Titanio desierto':'#cbb39e'};
  function colorButtons(variants,selected,onSelect){
    const fragment=document.createDocumentFragment();
    for(const v of variants){
      const button=document.createElement('button');button.type='button';button.className='color-swatch';button.dataset.variantId=v.id;
      button.setAttribute('aria-label',v.color);button.title=v.color;button.setAttribute('aria-pressed',String(v.id===selected));
      const dot=document.createElement('span');dot.className='color-dot';dot.setAttribute('aria-hidden','true');
      const colors=v.color.split(' / ').map(c=>colorPalette[c]||'#a3a8b3');dot.style.background=colors.length===1?colors[0]:'linear-gradient(135deg,'+colors.join(',')+')';
      button.append(dot);button.addEventListener('click',()=>onSelect(v,button));fragment.append(button);
    }
    return fragment;
  }
  function groupProducts(products){
    const grouped=new Map();
    for(const p of products){
      // Keep all variants and stock intact; only color may differ within a card.
      const key=JSON.stringify([p.manufacturer,p.model,p.capacity,p.condition,p.grade,p.battery,p.cycles??null,p.sim,p.box??null,p.ram||'',[...p.observations].sort(),p.priceCents]);
      if(!grouped.has(key))grouped.set(key,[]);
      const buckets=grouped.get(key);
      // Distinct source descriptions can produce separate rows in the same color.
      // Preserve those alternatives rather than presenting identical color buttons.
      let group=buckets.find(g=>!g.variants.some(v=>v.color===p.color));
      if(!group){group={key:key+':'+buckets.length,model:p.model,manufacturer:p.manufacturer,variants:[]};buckets.push(group);}
      group.variants.push(p);
    }
    return [...grouped.values()].flat();
  }
  function render(){
    const query=nodes.search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matches=groups.map(g=>({...g,variants:g.variants.filter(v=>(nodes.capacity.value==='all'||v.capacity===nodes.capacity.value)&&`${v.model} ${v.manufacturer} ${v.capacity} ${v.color}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))})).filter(g=>(brand==='all'||g.manufacturer===brand)&&g.variants.length);
    const lowest=g=>Math.min(...g.variants.map(v=>v.priceCents));
    matches.sort((a,b)=>nodes.sort.value==='low'?lowest(a)-lowest(b)||collator.compare(a.model,b.model):nodes.sort.value==='high'?lowest(b)-lowest(a)||collator.compare(a.model,b.model):collator.compare(a.model,b.model));
    const fragment=document.createDocumentFragment();
    const stale=Date.now()-Date.parse(catalog.updatedAt)>2*60*60*1000;
    for(const group of matches){
      fragment.append(createCard(group,stale));
    }
    nodes.products.replaceChildren(fragment);
    const units=matches.flatMap(g=>g.variants).reduce((n,v)=>n+(v.quantity||0),0);
    nodes.count.textContent=`${matches.length} ${matches.length===1?'opción':'opciones'}${units?' · '+units+' equipo'+(units===1?'':'s'):''}`;
    $('#empty').hidden=matches.length!==0;
  }
  function createCard(group,stale){
      const card=$('#card').content.firstElementChild.cloneNode(true);
      card.classList.toggle('samsung',group.manufacturer==='Samsung');
      card.querySelector('.manufacturer').textContent=group.manufacturer==='Apple'?'iPhone · Lunivo':'Samsung · Lunivo';
      card.querySelector('.product-name').textContent=group.model;
      const device=group.variants.find(v=>v.id===selectedColors.get(group.key))||group.variants[0];
      card.querySelector('.summary').textContent=[device.capacity,device.color].join(' · ');
      const details=[device.condition,device.ram?'RAM '+device.ram:'',device.grade?'Categoría '+device.grade:'','Batería '+batteryText(device),device.cycles!==null&&device.cycles!==undefined?device.cycles+' ciclos':'',device.sim!=='Por confirmar'?device.sim:'',typeof device.box==='boolean'?(device.box?'Con caja':'Sin caja'):'',...device.observations].filter(Boolean);
      card.querySelector('.variant-specs').textContent=details.join(' · ');
      const image=card.querySelector('.product-image'),picture=images[device.model+'|'+device.color];
      if(picture){framePhoto(image,picture);image.src=picture.path;image.alt=device.model+', '+device.color+' · imagen oficial de referencia';image.hidden=false;card.querySelector('.image-caption').textContent='Imagen de referencia · '+device.color;card.querySelector('.image-placeholder').hidden=true;image.addEventListener('error',()=>{image.hidden=true;image.closest('.photo-frame').hidden=true;card.querySelector('.image-placeholder').hidden=false;card.querySelector('.image-caption').hidden=true;},{once:true});}
      else{card.querySelector('.image-caption').hidden=true;card.querySelector('.image-placeholder').textContent='Foto de este color pendiente';}
      card.dataset.productId=device.id;
      const prices=group.variants.map(v=>v.priceCents);
      card.querySelector('.from').textContent='Precio promocional';
      card.querySelector('.regular-price s').textContent=money(regularPrice(Math.min(...prices)));
      card.querySelector('.price').textContent=money(Math.min(...prices));
      const units=Number.isSafeInteger(device.quantity)?device.quantity:null;
      card.querySelector('.availability').textContent=stale?'Consultar stock':units===null?'● Disponible':`${units} disponible${units===1?'':'s'}`;
      card.querySelector('.view').setAttribute('aria-label',`Ver ${group.model}, ${device.capacity}, ${device.color}, ${money(device.priceCents)}`);
      card.querySelector('.product-photo').setAttribute('aria-label',`Ver detalles de ${group.model}, ${device.capacity}, ${device.color}`);
      for(const button of card.querySelectorAll('.view,.product-photo,.product-name')){
        button.setAttribute('aria-haspopup','dialog');
        button.addEventListener('click',()=>openDetails(group,card.dataset.productId));
      }
      const colors=card.querySelector('.color-options');
      colors.setAttribute('aria-label','Colores de '+group.model);
      colors.append(colorButtons(group.variants,device.id,(v)=>{
        selectedColors.set(group.key,v.id);
        const replacement=createCard(group,stale);card.replaceWith(replacement);
        replacement.querySelector('[data-variant-id="'+v.id+'"]').focus({preventScroll:true});
      }));
      return card;
  }
  function showVariant(){
    const p=activeGroup?.variants.find(v=>v.id===nodes.variant.value);
    if(!p)return;
    const specs=[['Capacidad',p.capacity],['Color',p.color],['Estado',p.condition],['Batería',batteryText(p).replace(/^e/,'E')]];
    if(p.grade)specs.push(['Categoría',p.grade]);
    if(Number.isSafeInteger(p.quantity))specs.push(['Disponibles',String(p.quantity)]);
    if(p.cycles!==null&&p.cycles!==undefined)specs.push(['Ciclos de batería',String(p.cycles)]);
    if(p.sim&&p.sim!=='Por confirmar')specs.push(['Tipo de SIM',p.sim]);
    if(p.ram)specs.push(['Memoria RAM',p.ram]);
    if(typeof p.box==='boolean')specs.push(['Caja',p.box?'Incluida':'Sin caja']);
    if(p.observations.length)specs.push(['A tener en cuenta',p.observations.join(' · ')]);
    const fragment=document.createDocumentFragment();
    for(const [name,value]of specs){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);fragment.append(row);}
    $('#specs').replaceChildren(fragment);
    for(const button of $('#detail-colors').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.variantId===p.id));
    updatePayment();
  }
  function updatePayment(){
    const p=activeGroup?.variants.find(v=>v.id===nodes.variant.value);if(!p)return;
    const financed=$('[name=payment]:checked').value==='installments',regular=regularPrice(p.priceCents);
    const bank=banks.find(b=>b.id===$('#payment-bank').value),months=Number($('[name=installment-term]:checked')?.value||0);
    renderInstallments(regular,bank,months);
    $('#financing').hidden=!financed;
    $('#detail-regular').hidden=financed;$('#detail-regular s').textContent=money(regular);
    $('#detail-price-label').textContent=financed?'Precio regular':'Precio promocional';
    $('#detail-payment-note').textContent=financed?'Total a pagar a tasa cero':'Precio exclusivo por pago de contado';
    $('#detail-price').textContent=money(financed?regular:p.priceCents);
    $('#detail-price').classList.toggle('is-regular',financed);
    let summary='Selecciona un banco para ver sus cuotas.';
    const paymentLines=[financed?'💰 A tasa cero, precio regular: '+money(regular):'💰 Al contado, precio promocional: '+money(p.priceCents)];
    if(financed){
      if(!banks.length)summary='No se pudieron cargar las cuotas. Consúltalas con Lunivo por WhatsApp.';
      else if(bank){
        summary=bank.installments.length?'Selecciona el número de cuotas.':'Cuotas de este banco por confirmar con Lunivo.';
        if(bank.installments.includes(months)){
          summary='';
          paymentLines.push('🏦 '+bank.name+' · '+months+' cuotas - '+money(Math.floor(regular/months)));
        }else paymentLines.push('🏦 '+bank.name+' · Quiero consultar las cuotas disponibles.');
      }else paymentLines.push('🏦 Quiero conocer los bancos y cuotas disponibles.');
    }
    $('#installment-summary').textContent=summary;
    $('#installment-summary').hidden=!summary;
    const color=p.color.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const colorIcon=/verde/.test(color)?'🟢':/negro|grafito/.test(color)?'⚫️':/blanco|plata/.test(color)?'⚪️':/azul|celeste/.test(color)?'🔵':/morado|lila|violeta/.test(color)?'🟣':/rojo/.test(color)?'🔴':/anaranjado|naranja/.test(color)?'🟠':/amarillo|dorado/.test(color)?'🟡':'🔘';
    const deviceLines=[
      '📲 '+p.model+' - '+p.capacity,
      '⭐️ Estado: '+p.condition+(p.grade?', categoría '+p.grade:''),
      '🔋 Batería '+batteryText(p),
      colorIcon+' Color '+p.color
    ];
    if(p.ram)deviceLines.push('🧠 RAM: '+p.ram);
    if(p.cycles!==null&&p.cycles!==undefined)deviceLines.push('🔄 Ciclos: '+p.cycles);
    if(p.sim&&p.sim!=='Por confirmar')deviceLines.push('📶 '+p.sim);
    if(typeof p.box==='boolean')deviceLines.push('📦 '+(p.box?'Con caja':'Sin caja'));
    if(p.observations.length)deviceLines.push('📝 Observaciones: '+p.observations.join(', '));
    const text=['Hola 👋 Lunivo, me interesa el siguiente dispositivo:',deviceLines.join('\n'),paymentLines.join('\n'),'¿Cómo realizo la compra?'].join('\n\n');
    // The direct endpoint preserves Unicode when the short-link redirect does not.
    $('#consult').href='https://api.whatsapp.com/send?phone=50376241930&text='+encodeURIComponent(text);
  }
  function openDetails(group,selectedId){
    activeGroup=group;
    $('[name=payment][value=cash]').checked=true;
    $('#payment-bank').replaceChildren(option('','Selecciona tu banco'),...banks.map(b=>option(b.id,b.name)));
    resetInstallments();
    $('#detail-title').textContent=group.model;
    const sorted=[...group.variants].sort((a,b)=>a.priceCents-b.priceCents||collator.compare(a.capacity,b.capacity));
    nodes.variant.replaceChildren(...sorted.map(v=>option(v.id,[v.capacity,v.color,v.condition,v.grade?`Categoría ${v.grade}`:'',v.manufacturer==='Samsung'?'Batería '+batteryText(v):v.battery?`Bat. ${v.battery}`:'',v.cycles!==null&&v.cycles!==undefined?`${v.cycles} ciclos`:'',v.sim!=='Por confirmar'?v.sim:'',typeof v.box==='boolean'?(v.box?'Con caja':'Sin caja'):'',...v.observations,money(v.priceCents),v.quantity?`${v.quantity} disponibles`:''].filter(Boolean).join(' · '))));
    nodes.variant.value=sorted.some(v=>v.id===selectedId)?selectedId:sorted[0].id;
    nodes.variant.hidden=true;
    document.querySelector('label[for=variant]').hidden=true;
    $('#detail-colors').replaceChildren(colorButtons(sorted,nodes.variant.value,(v)=>{nodes.variant.value=v.id;selectedColors.set(group.key,v.id);showVariant();const card=nodes.products.querySelector('[data-variant-id="'+v.id+'"]')?.closest('.card');if(card)card.replaceWith(createCard(group,Date.now()-Date.parse(catalog.updatedAt)>2*60*60*1000));}));
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
      groups=groupProducts(catalog.products);
      await Promise.all([imagesReady,plansReady]);
      paintHero(catalog);
      nodes.capacity.replaceChildren(option('all','Toda capacidad'),...[...new Set(catalog.products.map(v=>v.capacity))].sort(collator.compare).map(c=>option(c,c)));
      if([...nodes.capacity.options].some(o=>o.value===previousCapacity))nodes.capacity.value=previousCapacity;
      $('#updated').textContent='Inventario actualizado: '+new Intl.DateTimeFormat('es-SV',{dateStyle:'medium',timeStyle:'short',timeZone:'America/El_Salvador'}).format(new Date(catalog.updatedAt))+' · El Salvador';
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
  function resetInstallments(){
    $('#installment-grid').replaceChildren();delete $('#installment-grid').dataset.plan;$('#installment-options').hidden=true;
  }
  function renderInstallments(total,bank,selected){
    const terms=bank?[...bank.installments].sort((a,b)=>a-b):[],grid=$('#installment-grid');
    $('#installment-options').hidden=!terms.length;
    // Keep the radio being used in place, so keyboard focus survives a selection.
    const signature=JSON.stringify([total,bank?.id,terms]);
    if(grid.dataset.plan===signature)return;
    grid.dataset.plan=signature;
    const fragment=document.createDocumentFragment();
    for(const months of terms){
      const each=Math.floor(total/months);
      const label=document.createElement('label'),input=document.createElement('input'),copy=document.createElement('span'),name=document.createElement('span'),amount=document.createElement('strong');
      input.type='radio';input.name='installment-term';input.value=String(months);input.checked=selected===months;
      name.textContent=months+' cuotas';amount.textContent=money(each);
      copy.append(name,amount);label.append(input,copy);fragment.append(label);
    }
    grid.replaceChildren(fragment);
  }
  document.querySelectorAll('[name=payment]').forEach(input=>input.addEventListener('change',updatePayment));
  $('#payment-bank').addEventListener('change',()=>{resetInstallments();updatePayment();});
  $('#installment-grid').addEventListener('change',updatePayment);
  nodes.variant.addEventListener('change',showVariant);
  $('#close').addEventListener('click',()=>nodes.dialog.close());
  nodes.dialog.addEventListener('click',event=>{if(event.target!==nodes.dialog)return;const r=nodes.dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)nodes.dialog.close();});
  $('#retry').addEventListener('click',()=>load());
  setInterval(()=>{if(document.visibilityState==='visible')load(true);},5*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(true);});
  load();
})();
