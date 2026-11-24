(function(root,factory){const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else root.LunivoDevices=core;})(typeof window==='object'?window:globalThis,()=>{
'use strict';
const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const isWearable=item=>/\b(?:watch|smartwatch|reloj(?:es)?|smart\s*band|mi\s*band)\b/i.test(typeof item==='string'?item:item?.model||'');
function model(item){
 const raw=text(typeof item==='string'?item:item?.model),name=raw.split(' · ')[0];
 if(/^(?:apple\s+)?i\s*phone\s*air(?![a-z])/i.test(name))return 'iPhone 17 Air'; // same phone as "iPhone 17 Air"
 // 16e/17e are their own models: never group them with the 16/17.
 let m=name.match(/^(?:apple\s+)?i\s*phone\s*(?:(\d{1,2})(e(?![a-z]))?|(SE|XR|XS|X)(?![a-z]))(?:\s*(pro\s*max|pro|plus|mini|air|max(?=\s|$|\d)))?/i);
 if(m&&!(m[4]&&/^max$/i.test(m[4])&&!/^xs$/i.test(m[3]||'')))return 'iPhone '+(m[1]?m[1]+(m[2]?'e':''):m[3].toUpperCase())+(m[4]?' '+m[4].toLowerCase().replace(/pro\s*max/,'pro max').replace(/\b\w/g,c=>c.toUpperCase()):'');
 m=name.match(/^(?:(?:samsung\s*)?(?:galaxy\s*)?)((?:z\s*(?:flip|fold)|note|s|a|m)\s*\d{1,3})(?:\s*(ultra|fe|plus|edge|\+))?/i);
 if(m){const base=m[1].replace(/\s/g,'').replace(/^z(flip|fold)(\d+)/i,(_,kind,n)=>'Z '+kind[0].toUpperCase()+kind.slice(1).toLowerCase()+' '+n).replace(/^note(\d+)/i,'Note $1').replace(/^([sam])/i,c=>c.toUpperCase());return 'Samsung '+base+(m[2]?' '+(/fe/i.test(m[2])?'FE':m[2]==='+'?'Plus':m[2][0].toUpperCase()+m[2].slice(1).toLowerCase()):'');}
 return name;
}
const modelKey=item=>model(item).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function capacity(item){const explicit=text(item?.capacity);if(explicit)return explicit.replace(/\s*(gb|tb)\b/ig,(_,unit)=>' '+unit.toUpperCase());const matches=[...(text(item?.model)+' '+text(item?.notes)).matchAll(/\b(\d{2,4})\s*(GB)|\b([1-8])\s*(TB)/gi)];const value=matches.find(m=>Number(m[1]||32)>=32);return value?(value[1]||value[3])+' '+(value[2]||value[4]).toUpperCase():'';}
function color(item){return text(item?.color)||((text(item?.model).match(/\b(?:titanio\s+(?:natural|negro|azul|desierto)|negro|blanco|gris|plata|plateado|dorado|azul|celeste|morado|lila|rojo|rosa|rosado|verde|amarillo|anaranjado)\b/i)||[])[0]||'');}
const family=item=>isWearable(item)?'':/^iPhone\b/.test(model(item))?'iphone':/^Samsung\b/.test(model(item))?'samsung':'';
const storage=item=>{const value=capacity(item);return Number.parseFloat(value)*(value.includes('TB')?1024:1)||0;};
const compare=(a,b)=>collator.compare(model(a),model(b))||storage(a)-storage(b)||collator.compare(color(a),color(b));
return{isWearable,model,modelKey,capacity,color,family,compare};
});
