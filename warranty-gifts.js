(()=>{'use strict';
const catalog=[['charger','Cargador completo','Cable y cubo',2500],['protector','Protector de pantalla','Hidrogel o vidrio templado',1000],['case','Case','Funda para el dispositivo',0],['box','Caja genérica','Caja entregada con el equipo',0]];
function create(container,prefix){
 const fieldset=document.createElement('fieldset');fieldset.className='wide warranty-gifts';
 const legend=document.createElement('legend');legend.textContent='Accesorios de cortesía';
 const hint=document.createElement('p');hint.className='hint';hint.textContent='Selecciona varios o agrega otro accesorio. Los valores son de referencia y no se cobran al cliente.';
 const list=document.createElement('div'),custom=document.createElement('div'),message=document.createElement('p'),add=document.createElement('button');
 message.id=prefix+'-gift-error';message.className='hint';message.setAttribute('role','status');add.id=prefix+'-gift-add';add.type='button';add.className='secondary';add.textContent='+ Otro accesorio';
 fieldset.append(legend,hint,list,custom,add,message);container.append(fieldset);
 let extras=[],excluded=new Set();const rows=new Map();
 const signal=()=>fieldset.dispatchEvent(new Event('input',{bubbles:true}));
 const count=()=>extras.length+[...rows.values()].filter(r=>r.check.checked).length;
 function updateLimit(){add.disabled=count()>=10;add.textContent=add.disabled?'Límite de 10 cortesías':'+ Otro accesorio';}
 function toggle(row){row.values.hidden=!row.check.checked;row.amount.disabled=!row.check.checked||row.check.disabled;}
 for(const[id,name,description,reference]of catalog){
  const row=document.createElement('div');row.className='accessory-option warranty-gift-option';
  const label=document.createElement('label');label.className='accessory-pick';const check=document.createElement('input');check.type='checkbox';check.id=prefix+'-gift-'+id;
  const copy=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=name;detail.textContent=description;copy.append(title,detail);label.append(check,copy);
  const values=document.createElement('div');values.className='accessory-values';const priceLabel=document.createElement('label');priceLabel.textContent='Valor de referencia $';const amount=document.createElement('input');amount.id=prefix+'-gift-price-'+id;amount.type='number';amount.min='0';amount.step='.01';amount.value=(reference/100).toFixed(2);amount.setAttribute('aria-label','Valor referencial de '+name);priceLabel.append(amount);values.append(priceLabel);
  const entry={check,amount,values,row,name,reference};rows.set(id,entry);row.append(label,values);list.append(row);toggle(entry);
  check.addEventListener('change',()=>{message.textContent='';if(count()>10){check.checked=false;message.textContent='Puedes registrar hasta 10 cortesías en una garantía.';}toggle(entry);updateLimit();});
 }
 function renderExtras(){
  custom.replaceChildren();
  for(const item of extras){
   const row=document.createElement('div');row.className='accessory-extra warranty-gift-extra';const nameLabel=document.createElement('label');nameLabel.textContent='Otro accesorio de cortesía';const name=document.createElement('input');name.id=prefix+'-gift-name-'+item.id;name.maxLength=150;name.placeholder='Ej. Audífonos';name.value=item.name;nameLabel.append(name);
   const priceLabel=document.createElement('label');priceLabel.textContent='Valor de referencia $';const amount=document.createElement('input');amount.id=prefix+'-gift-extra-price-'+item.id;amount.type='number';amount.min='0';amount.step='.01';amount.value=item.amount;priceLabel.append(amount);
   const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Quitar';remove.setAttribute('aria-label','Quitar cortesía '+(item.name||'adicional'));remove.addEventListener('click',()=>{for(const input of row.querySelectorAll('input'))input.dispatchEvent(new Event('input',{bubbles:true}));extras=extras.filter(v=>v!==item);renderExtras();message.textContent='';signal();add.focus();});
   name.addEventListener('input',()=>{item.name=name.value;remove.setAttribute('aria-label','Quitar cortesía '+(item.name||'adicional'));});amount.addEventListener('input',()=>item.amount=amount.value);
   row.append(nameLabel,priceLabel,remove);custom.append(row);
  }
  updateLimit();
 }
 add.addEventListener('click',()=>{if(count()>=10)return;extras.push({id:crypto.randomUUID(),name:'',amount:'0.00'});renderExtras();message.textContent='';signal();custom.lastElementChild.querySelector('input').focus();});
 function invalid(fieldId,text){throw Object.assign(Error(text),{fieldId});}
 function price(input){try{return LunivoSalesCore.money(input.value);}catch{invalid(input.id,'Revisa el valor referencial; puedes usar $0.');}}
 function read(){
  const gifts=[];for(const row of rows.values())if(row.check.checked&&!row.check.disabled)gifts.push({name:row.name,reference:price(row.amount)});
  for(const item of extras){const name=item.name.trim();if(!name||name.length>150)invalid(prefix+'-gift-name-'+item.id,'Escribe el nombre de la cortesía adicional (máximo 150 caracteres).');gifts.push({name,reference:price(document.getElementById(prefix+'-gift-extra-price-'+item.id))});}
  if(gifts.length>10)invalid(add.id,'Puedes registrar hasta 10 cortesías en una garantía.');return gifts;
 }
 function load(gifts=[]){
  extras=[];excluded=new Set();message.textContent='';const pending=[...gifts];
  for(const row of rows.values()){const index=pending.findIndex(g=>g.name===row.name),gift=index>=0?pending.splice(index,1)[0]:null;row.check.disabled=false;row.check.checked=Boolean(gift);row.amount.value=((gift?.reference??row.reference)/100).toFixed(2);row.row.removeAttribute('title');toggle(row);}
  extras=pending.map(g=>({id:crypto.randomUUID(),name:g.name,amount:(g.reference/100).toFixed(2)}));renderExtras();
 }
 function exclude(items=[]){excluded=new Set(items.map(v=>v.catalogId));for(const[id,row]of rows){row.check.disabled=excluded.has(id);if(row.check.disabled)row.check.checked=false;row.row.title=row.check.disabled?'Ya está incluido en los accesorios de la venta':'';toggle(row);}updateLimit();}
 return{read,load,exclude};
}
window.LunivoWarrantyGifts={create};
})();
