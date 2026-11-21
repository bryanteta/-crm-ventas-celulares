/* Brand/model navigation shares the web catalog's jump-to-version behavior. */
(()=>{'use strict';
const devices=window.LunivoDevices,collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
function create(id,familyButtons){
 const brands=document.querySelector(familyButtons).parentElement,wrapper=document.createElement('div'),nav=document.createElement('nav');
 wrapper.className='app-device-navigation';brands.before(wrapper);wrapper.append(brands,nav);nav.id=id;nav.className='device-version-scroll';nav.hidden=true;
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
   pressed();
  },
  scroll(list,model,keyboard=false){const target=model?[...list.querySelectorAll('[data-device-model]')].find(n=>n.dataset.deviceModel===model):list;if(!target)return;if(keyboard){target.tabIndex=-1;target.focus({preventScroll:true});}target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});},
  reset(){signature='';scope='';selected='';nav.replaceChildren();nav.hidden=true;}
 };
}
window.LunivoDeviceNavigation={create};
})();
