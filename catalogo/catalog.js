'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const money = value => new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value/100);
  const nodes={products:$('#products'),count:$('#count'),search:$('#search'),capacity:$('#capacity'),sort:$('#sort'),dialog:$('#details'),variant:$('#variant')};
  let catalog=null, groups=[], brand='all', activeGroup=null, loading=false;
  let selectedVersion='all',versionSignature='';
  let images={};
  const selectedColors=new Map();
  let inventoryEndpoint='',lastInventoryCheck=0;
  const inventorySourceReady=fetch('inventory-source.json',{cache:'no-cache',signal:AbortSignal.timeout(3000)}).then(async response=>{
    if(!response.ok)return;const config=await response.json();if(config.version!==1||!config.endpoint)return;
    const url=new URL(config.endpoint);
    if(url.protocol==='https:'&&url.hostname.endsWith('.workers.dev')&&!url.username&&!url.password&&url.pathname==='/inventory.json'&&!url.search&&!url.hash)inventoryEndpoint=url.href;
  }).catch(()=>{});
  async function readInventory(){
    await inventorySourceReady;
    let freshest=null;
    for(const url of [...(inventoryEndpoint?[inventoryEndpoint]:[]),'inventory.json']){
      try{const response=await fetch(url,{cache:'no-cache',credentials:'omit',signal:AbortSignal.timeout(inventoryEndpoint===url?5000:15000)});if(response.ok){const data=valid(await response.json());if(!freshest||Date.parse(data.updatedAt)>Date.parse(freshest.updatedAt))freshest=data;if(url===inventoryEndpoint&&Date.now()-Date.parse(data.updatedAt)<15*60*1000)return data;}}catch{/* Fall back to the published public snapshot. */}
    }
    if(freshest)return freshest;throw Error('Inventario no disponible');
  }

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
  let lastImagesCheck=0;
  function loadImages(){lastImagesCheck=Date.now();return fetch('product-images.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)}).then(async r=>{
    if(!r.ok)return;
    const data=await r.json();
    if(data.version!==2)return;
    for(const [key,item]of Object.entries(data.products||{})){
      if(key===item.model+'|'+item.color&&typeof item.color==='string'&&/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(item.path))images[key]=item;
    }
  }).catch(()=>{});}
  const imagesReady=loadImages();
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
  function deviceSeries(group){
    const iphone=group.model.match(/^iPhone (\d+)\b/i);
    if(group.manufacturer==='Apple'&&iphone)return {key:'apple-'+iphone[1],title:'iPhone '+iphone[1],manufacturer:'Apple'};
    const galaxy=group.model.match(/^Samsung S(\d+)\b/i);
    if(group.manufacturer==='Samsung'&&galaxy)return {key:'samsung-s'+galaxy[1],title:'Galaxy S'+galaxy[1],manufacturer:'Samsung'};
    const foldable=group.model.match(/^Samsung Z (Flip|Fold)\b/i);
    if(group.manufacturer==='Samsung'&&foldable)return {key:'samsung-z-'+foldable[1].toLowerCase(),title:'Galaxy Z '+foldable[1],manufacturer:'Samsung'};
    return {key:group.manufacturer+'-'+group.model,title:group.model,manufacturer:group.manufacturer};
  }
  function versionName(model){return model.replace(/^Samsung /,'Galaxy ');}
  function versionLabel(model,family){const name=versionName(model);return family.title.startsWith('Galaxy Z ')?name.replace(/^Galaxy /,''):(name.slice(family.title.length).trim()||'Estándar');}
  function renderVersions(){
    const bar=$('#version-bar'),nav=$('#version-list');bar.hidden=brand==='all';if(bar.hidden)return;
    const models=[...new Set(groups.filter(g=>g.manufacturer===brand).map(g=>g.model))].sort(collator.compare);
    const removed=selectedVersion!=='all'&&!models.includes(selectedVersion);if(removed)selectedVersion='all';
    const label=brand==='Apple'?'iPhone':'Samsung',signature=JSON.stringify([brand,models]);
    bar.setAttribute('aria-label','Versiones de '+label);
    if(signature!==versionSignature){
      const previousScroll=nav.dataset.brand===brand&&!removed?nav.scrollLeft:0;versionSignature=signature;const focused=nav.contains(document.activeElement)?document.activeElement.dataset.version:null,fragment=document.createDocumentFragment();
      function button(text,model){const b=document.createElement('button');b.type='button';b.className='version-option';b.textContent=text;b.dataset.version=model;return b;}
      const all=button('Todos','all');all.setAttribute('aria-label','Todos los '+label);fragment.append(all);
      for(const model of models)fragment.append(button(versionName(model),model));
      nav.replaceChildren(fragment);nav.dataset.brand=brand;nav.scrollLeft=previousScroll;
      if(focused){const next=[...nav.children].find(b=>b.dataset.version===focused)||all;next.focus({preventScroll:true});}
    }
    for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.version===selectedVersion));
  }
  $('#version-list').addEventListener('click',event=>{
    const b=event.target.closest('button[data-version]');if(!b||!catalog)return;
    selectedVersion=b.dataset.version;
    function destination(){return selectedVersion==='all'?nodes.products:[...nodes.products.querySelectorAll('.model-version')].find(n=>n.dataset.versionModel===selectedVersion)||[...nodes.products.querySelectorAll('.card')].find(n=>n.dataset.versionModel===selectedVersion);}
    let target=destination();
    // Clear restrictive search/capacity filters only when they hide the destination.
    if(!target){nodes.search.value='';nodes.capacity.value='all';render();target=destination();}
    else renderVersions();
    const nav=$('#version-list');nav.scrollTo({left:b.offsetLeft-(nav.clientWidth-b.offsetWidth)/2,behavior:'instant'});
    if(target){
      if(event.detail===0){target.tabIndex=-1;target.focus({preventScroll:true});}
      target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
    }
  });
  $('#version-list').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...event.currentTarget.children],i=buttons.indexOf(document.activeElement);if(i<0)return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(event.key==='ArrowRight'?1:-1)));
    buttons[next].focus();
  });
  function seriesSection(series,stale){
    const section=document.createElement('section');section.className='catalog-series';section.setAttribute('aria-label','Serie '+series.title);
    const heading=document.createElement('div');heading.className='series-heading';
    const title=document.createElement('h3');title.textContent=series.title;
    heading.append(title);
    const grid=document.createElement('div');grid.className='products series-products';
    const versions=new Map();
    for(const group of series.groups){if(!versions.has(group.model))versions.set(group.model,[]);versions.get(group.model).push(group);}
    for(const [model,options]of versions){
      const version=document.createElement('section');version.className='model-version';version.dataset.versionModel=model;version.setAttribute('aria-label','Versión '+model);
      const name=document.createElement('h4');name.textContent=versionLabel(model,series);
      const cards=document.createElement('div');cards.className='products version-products';for(const group of options)cards.append(createCard(group,stale));
      version.append(name,cards);grid.append(version);
    }
    section.append(heading,grid);return section;
  }
  function render(){
    renderVersions();
    const query=nodes.search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matches=groups.map(g=>({...g,variants:g.variants.filter(v=>(nodes.capacity.value==='all'||v.capacity===nodes.capacity.value)&&`${v.model} ${v.manufacturer} ${v.capacity} ${v.color} ${deviceSeries(g).title}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))})).filter(g=>(brand==='all'||g.manufacturer===brand)&&g.variants.length);
    const lowest=g=>Math.min(...g.variants.map(v=>v.priceCents));
    const direction=nodes.sort.value==='model-desc'?-1:1;
    matches.sort((a,b)=>nodes.sort.value==='low'?lowest(a)-lowest(b)||collator.compare(a.model,b.model):nodes.sort.value==='high'?lowest(b)-lowest(a)||collator.compare(a.model,b.model):direction*collator.compare(a.model,b.model));
    const fragment=document.createDocumentFragment();
    const stale=Date.now()-Date.parse(catalog.updatedAt)>2*60*60*1000;
    if(['model','model-desc'].includes(nodes.sort.value)){
      const series=new Map();
      for(const group of matches){
        const family=deviceSeries(group);
        if(!series.has(family.key))series.set(family.key,{...family,groups:[]});
        series.get(family.key).groups.push(group);
      }
      const ordered=[...series.values()].sort((a,b)=>(a.manufacturer==='Apple'?0:1)-(b.manufacturer==='Apple'?0:1)||direction*collator.compare(a.title,b.title));
      for(const family of ordered)fragment.append(seriesSection(family,stale));
    }else for(const group of matches)fragment.append(createCard(group,stale));
    nodes.products.replaceChildren(fragment);
    const units=matches.flatMap(g=>g.variants).reduce((n,v)=>n+(v.quantity||0),0);
    nodes.count.textContent=`${matches.length} ${matches.length===1?'opción':'opciones'}${units?' · '+units+' equipo'+(units===1?'':'s'):''}`;
    $('#empty').hidden=matches.length!==0;
  }
  function createCard(group,stale){
      const card=$('#card').content.firstElementChild.cloneNode(true);
      card.classList.toggle('samsung',group.manufacturer==='Samsung');card.dataset.versionModel=group.model;
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
    window.LunivoProductGallery?.show(p,images[p.model+'|'+p.color]);
    for(const button of $('#detail-colors').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.variantId===p.id));
    updatePayment();
  }
  function renderBanks(){
    $('#bank-picker').hidden=!banks.length;$('#bank-dropdown').open=false;delete $('#bank-current-content').dataset.bankId;
    $('#bank-choices').replaceChildren(...banks.map(bank=>{
      const button=document.createElement('button');button.type='button';button.className='bank-choice';button.dataset.bankId=bank.id;
      button.setAttribute('aria-pressed','false');
      const frame=document.createElement('span');frame.className='bank-logo';
      const art=bank.logo,f=art?.framing;
      if(art&&/^assets\/banks\/[a-z]+\.(?:png|webp)$/.test(art.path)&&f&&[art.width,art.height,f.x,f.y,f.width,f.height].every(Number.isFinite)&&art.width>0&&art.height>0&&f.x>=0&&f.y>=0&&f.width>0&&f.height>0&&f.x+f.width<=art.width&&f.y+f.height<=art.height){
        const crop=document.createElement('span');crop.className='bank-logo-crop';const logo=document.createElement('img');logo.src=art.path;logo.alt='';logo.width=art.width;logo.height=art.height;crop.append(logo);frame.append(crop);framePhoto(logo,art);
        logo.addEventListener('error',()=>{frame.hidden=true;},{once:true});
      }else frame.hidden=true;
      const name=document.createElement('span');name.className='bank-name';name.textContent=bank.name;button.setAttribute('aria-label',bank.name);
      button.append(frame,name);button.addEventListener('click',()=>{
        $('#payment-bank').value=bank.id;$('#payment-bank').dispatchEvent(new Event('change',{bubbles:true}));$('#bank-dropdown').open=false;$('#bank-current').focus({preventScroll:true});
      });return button;
    }));
  }
  function showSelectedBank(bank){
    const current=$('#bank-current-content'),id=bank?.id||'';if(current.dataset.bankId===id)return;current.dataset.bankId=id;
    if(!bank){current.textContent='Selecciona tu banco';return;}
    const art=$('#bank-choices [data-bank-id="'+id+'"] .bank-logo')?.cloneNode(true),name=document.createElement('span');name.className='bank-current-name';name.textContent=bank.name;current.replaceChildren();
    if(art){const img=art.querySelector('img');if(img)img.addEventListener('error',()=>art.hidden=true,{once:true});current.append(art);}current.append(name);
  }
  function updatePayment(){
    const p=activeGroup?.variants.find(v=>v.id===nodes.variant.value);if(!p)return;
    const financed=$('[name=payment]:checked').value==='installments',regular=regularPrice(p.priceCents);
    const bank=banks.find(b=>b.id===$('#payment-bank').value),months=Number($('[name=installment-term]:checked')?.value||0);
    for(const button of $('#bank-choices').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.bankId===bank?.id));
    showSelectedBank(bank);
    renderInstallments(regular,bank,months);
    $('#financing').hidden=!financed;if(!financed)$('#bank-dropdown').open=false;
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
    renderBanks();
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
    nodes.dialog.scrollTop=0;
  }
  async function load(background=false){
    if(loading||background&&nodes.dialog.open)return;loading=true;
    const previous=catalog;lastInventoryCheck=Date.now();
    const previousCapacity=nodes.capacity.value;
    nodes.products.setAttribute('aria-busy','true');$('#error').hidden=true;$('#empty').hidden=true;$('#notice').hidden=true;
    if(!background){nodes.count.textContent='Cargando modelos…';$('#updated').textContent='Consultando catálogo…';}
    try{
      const incoming=await readInventory();
      catalog=previous&&Date.parse(previous.updatedAt)>Date.parse(incoming.updatedAt)?previous:incoming;
      groups=groupProducts(catalog.products);
      await Promise.all([Date.now()-lastImagesCheck>=5*60*1000?loadImages():imagesReady,plansReady]);
      paintHero(catalog);
      nodes.capacity.replaceChildren(option('all','Capacidad'),...[...new Set(catalog.products.map(v=>v.capacity))].sort(collator.compare).map(c=>option(c,c)));
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
  document.querySelectorAll('[data-brand]').forEach(button=>button.addEventListener('click',()=>{brand=button.dataset.brand;selectedVersion='all';document.querySelectorAll('[data-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(catalog){render();$('#version-list').scrollLeft=0;}}));
  $('#reset').addEventListener('click',()=>{brand='all';selectedVersion='all';nodes.search.value='';nodes.capacity.value='all';nodes.sort.value='model';document.querySelectorAll('[data-brand]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brand==='all')));if(catalog)render();nodes.search.focus();});
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
  function positionBankMenu(){
    const dropdown=$('#bank-dropdown');if(!dropdown.open||!nodes.dialog.open)return;
    const trigger=$('#bank-current').getBoundingClientRect(),dialog=nodes.dialog.getBoundingClientRect(),viewport=window.visualViewport;
    const top=Math.max(dialog.top+12,(viewport?.offsetTop||0)+8),bottom=Math.min(dialog.bottom-12,(viewport?.offsetTop||0)+(viewport?.height||innerHeight)-8);
    if(trigger.bottom<top||trigger.top>bottom){dropdown.open=false;return;}
    const menu=$('#bank-choices'),above=Math.max(0,trigger.top-top-6),below=Math.max(0,bottom-trigger.bottom-6),needed=Math.min(260,menu.scrollHeight+2);
    const opensAbove=below<needed&&above>below,space=opensAbove?above:below;
    if(space<58){dropdown.open=false;return;}
    dropdown.dataset.placement=opensAbove?'above':'below';menu.style.setProperty('--bank-menu-max-height',Math.floor(Math.min(260,space))+'px');
  }
  let bankPositionFrame=null;
  function scheduleBankPosition(){if(!$('#bank-dropdown').open||bankPositionFrame!==null)return;bankPositionFrame=requestAnimationFrame(()=>{bankPositionFrame=null;positionBankMenu();});}
  // iOS gets the real system select; Android and desktop keep the logo menu.
  const iosBankPicker=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(iosBankPicker){
    $('#bank-dropdown').hidden=true;
    const select=$('#payment-bank');select.hidden=false;select.removeAttribute('aria-hidden');select.removeAttribute('tabindex');
    $('#bank-picker').classList.add('ios-bank-picker');
  }
  $('#bank-current').addEventListener('click',event=>{event.preventDefault();const dropdown=$('#bank-dropdown');dropdown.open=!dropdown.open;if(dropdown.open)positionBankMenu();});
  $('#bank-dropdown').addEventListener('toggle',()=>{if($('#bank-dropdown').open)positionBankMenu();});
  nodes.dialog.addEventListener('scroll',scheduleBankPosition,{passive:true});window.addEventListener('resize',scheduleBankPosition,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleBankPosition,{passive:true});window.visualViewport?.addEventListener('scroll',scheduleBankPosition,{passive:true});
  document.addEventListener('click',event=>{const dropdown=$('#bank-dropdown');if(dropdown.open&&!dropdown.contains(event.target))dropdown.open=false;});
  $('#bank-dropdown').addEventListener('keydown',event=>{if(event.key==='Escape'&&event.currentTarget.open){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;$('#bank-current').focus({preventScroll:true});}});
  $('#bank-dropdown').addEventListener('focusout',event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;});
  $('#payment-bank').addEventListener('change',()=>{resetInstallments();updatePayment();});
  $('#installment-grid').addEventListener('change',updatePayment);
  nodes.variant.addEventListener('change',showVariant);
  $('#close').addEventListener('click',()=>nodes.dialog.close());
  nodes.dialog.addEventListener('click',event=>{if(event.target!==nodes.dialog)return;const r=nodes.dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)nodes.dialog.close();});
  $('#retry').addEventListener('click',()=>load());
  setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastInventoryCheck>=(inventoryEndpoint?60:300)*1000)load(true);},60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(true);});
  const backToTop=$('#back-to-top');
  function updateBackToTop(){backToTop.hidden=window.scrollY<500;}
  window.addEventListener('scroll',updateBackToTop,{passive:true});
  window.addEventListener('pageshow',updateBackToTop);
  backToTop.addEventListener('click',()=>{
    const heading=document.querySelector('h1');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  });
  updateBackToTop();
  load();
})();
