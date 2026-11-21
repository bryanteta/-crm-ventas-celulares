/* Brand/model navigation shares the web catalog's jump-to-version behavior. */
(()=>{'use strict';
const devices=window.LunivoDevices,collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
function markBrowser(){document.body.classList.toggle('device-browser-page',/^#ventas\/(?:proveedores|inventario)(?:\?|$)/.test(location.hash));}window.addEventListener('hashchange',markBrowser);markBrowser();
function create(id,familyButtons){
 const brands=document.querySelector(familyButtons).parentElement,wrapper=document.createElement('div'),nav=document.createElement('nav');
 wrapper.className='app-device-navigation';brands.before(wrapper);wrapper.append(brands,nav);nav.id=id;nav.className='device-version-scroll';nav.hidden=true;
 const own=id==='inventory-version-menu',search=document.getElementById(own?'inventory-search':'offer-search').closest('label'),order=document.getElementById(own?'inventory-sort':'offer-sort').closest('label'),filters=document.getElementById(own?'inventory-more-filters':'provider-more-filters');
 const controls=document.createElement('section'),bottom=document.createElement('div');controls.className='device-browser-controls';controls.setAttribute('aria-label','Buscar y explorar dispositivos');bottom.className='device-browser-filter-row';search.before(controls);bottom.append(order,filters);controls.append(search,wrapper,bottom);order.firstChild.nodeValue='Ordenar';order.querySelector('select').setAttribute('aria-label','Ordenar dispositivos por modelo');if(own)filters.querySelector(':scope > summary').textContent='Filtros';

 const back=document.createElement('button');back.type='button';back.id=id+'-return';back.className='device-menu-return';back.hidden=true;back.setAttribute('aria-label','Subir al menú de dispositivos');back.title='Subir al menú';
 const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');path.setAttribute('d','M12 19V5m-6 6 6-6 6 6');arrow.append(path);back.append(arrow);document.body.append(back);
 let frame=null,observer=null,farAbove=false,menuBottom=0;
 const distance=()=>Math.max(500,innerHeight*.7);
 function updateBack(){frame=null;const editing=document.activeElement?.matches('input,textarea,select,[contenteditable=true]'),hidden=!farAbove||Boolean(wrapper.closest('[hidden]'))||Boolean(document.querySelector('dialog[open]'))||editing;if(back.hidden!==Boolean(hidden))back.hidden=Boolean(hidden);}
 function scheduleBack(){if(frame===null)frame=requestAnimationFrame(updateBack);}
 function observe(){if(observer)observer.disconnect();if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{const box=entries[entries.length-1].boundingClientRect;farAbove=box.width>0&&box.height>0&&box.bottom<-distance();scheduleBack();},{rootMargin:distance()+'px 0px 0px 0px',threshold:0});observer.observe(wrapper);}else{menuBottom=wrapper.getBoundingClientRect().bottom+window.scrollY;checkFallback();}}
 // Native visibility observation avoids geometry reads and style writes on each scroll frame.
 function checkFallback(){farAbove=window.scrollY>menuBottom+distance();scheduleBack();}
 if(!('IntersectionObserver' in window))window.addEventListener('scroll',checkFallback,{passive:true});
 window.addEventListener('resize',observe);window.addEventListener('hashchange',scheduleBack);document.addEventListener('focusin',scheduleBack);document.addEventListener('focusout',scheduleBack);observe();
 back.addEventListener('click',event=>{controls.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});if(event.detail===0)brands.querySelector('button')?.focus({preventScroll:true});scheduleBack();});
 let signature='',scope='',selected='',jump=()=>{};
 function pressed(){for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.deviceVersion===selected));}
 nav.addEventListener('click',event=>{const b=event.target.closest('button[data-device-version]');if(!b)return;selected=b.dataset.deviceVersion;pressed();nav.scrollTo({left:b.offsetLeft-(nav.clientWidth-b.offsetWidth)/2,behavior:'auto'});jump(selected,event.detail===0);});
 nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...nav.children],index=buttons.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowRight'?1:-1)));buttons[target].focus();});
 return {
  update(family,rows,context,onJump){
   const nextScope=String(window.LunivoStore.account())+'|'+context+'|'+family;if(nextScope!==scope){scope=nextScope;selected='';nav.scrollLeft=0;}
   const models=new Map();for(const row of rows)if(devices.family(row)===family)models.set(devices.modelKey(row),devices.model(row));
   const entries=[...models].sort((a,b)=>collator.compare(a[1],b[1]));if(selected&&!models.has(selected))selected='';jump=onJump;
   nav.hidden=!family||entries.length===0;nav.setAttribute('aria-label','Versiones de '+(family==='iphone'?'iPhone':'Samsung'));
   const nextSignature=JSON.stringify([scope,entries]);if(nextSignature!==signature){signature=nextSignature;const fragment=document.createDocumentFragment();for(const [key,label]of [['','Todos'],...entries]){const b=document.createElement('button');b.type='button';b.className='secondary device-version-button';b.dataset.deviceVersion=key;b.textContent=label.replace(/^Samsung /,'Galaxy ');fragment.append(b);}nav.replaceChildren(fragment);}
   pressed();if(observer)scheduleBack();else observe();
  },
  scroll(list,model,keyboard=false){const target=model?[...list.querySelectorAll('[data-device-model]')].find(n=>n.dataset.deviceModel===model):list;if(!target)return false;if(keyboard){target.tabIndex=-1;target.focus({preventScroll:true});}target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});return true;},
  reset(){farAbove=false;signature='';scope='';selected='';nav.replaceChildren();nav.hidden=true;back.hidden=true;scheduleBack();}
 };
}
window.LunivoDeviceNavigation={create};
})();
