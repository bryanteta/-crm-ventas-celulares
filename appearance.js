/* Apply the saved appearance before the document paints. No business data is written. */
(()=>{
'use strict';
const key='lunivo-appearance-v1',root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');
let preference='system',ready=false;
try{const saved=localStorage.getItem(key);if(['system','light','dark'].includes(saved))preference=saved;}catch{}
function apply(){
 const dark=preference==='dark'||preference==='system'&&system.matches;
 root.dataset.theme=dark?'dark':'light';root.dataset.themePreference=preference;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#0e1726':'#f4f6fa');
 for(const image of document.querySelectorAll('[data-theme-logo]'))image.src=dark?'assets/lunivo-mark-dark.png':'assets/lunivo-mark.png';
 const select=document.querySelector('#appearance-mode');if(select)select.value=preference;
 const status=document.querySelector('#appearance-status');if(status)status.textContent=preference==='system'?'Sigue el teléfono · '+(dark?'Oscuro':'Claro'):'Modo '+(dark?'oscuro':'claro')+' para este teléfono.';
 if(ready)try{window.CrmAndroid?.postMessage(JSON.stringify({type:'appearance',dark}));}catch{}
}
apply();system.addEventListener('change',()=>{if(preference==='system')apply();});
document.addEventListener('DOMContentLoaded',()=>{ready=true;apply();document.querySelector('#appearance-mode').addEventListener('change',event=>{
 const next=event.target.value;
 if(!['system','light','dark'].includes(next))return;
 try{localStorage.setItem(key,next);preference=next;apply();}catch{event.target.value=preference;document.querySelector('#appearance-status').textContent='No se pudo guardar el tema. Se conserva tu selección anterior.';}
});});
})();
