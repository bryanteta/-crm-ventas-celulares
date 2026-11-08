'use strict';
(() => {
  const key='lunivo-catalog-theme';
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const valid=value=>value==='dark'||value==='light';
  let choice=null;
  try{const saved=localStorage.getItem(key);if(valid(saved))choice=saved;}catch{/* System preference still works when storage is unavailable. */}
  function apply(){
    const theme=choice||(system.matches?'dark':'light');
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==='dark'?'#0c1220':'#f6f7fb';
    const button=document.getElementById('theme-toggle');
    if(button){const label=theme==='dark'?'Activar modo claro':'Activar modo oscuro';button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(theme==='dark'));}
  }
  apply();
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    document.getElementById('theme-toggle')?.addEventListener('click',()=>{
      choice=document.documentElement.dataset.theme==='dark'?'light':'dark';
      try{localStorage.setItem(key,choice);}catch{/* Keep the selection for this page. */}
      apply();
    });
  });
  system.addEventListener('change',()=>{if(!choice)apply();});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){choice=valid(event.newValue)?event.newValue:null;apply();}});
})();
