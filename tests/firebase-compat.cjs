// Verify that normal single-brand records work with both previously delivered rule sets.
const fs=require('node:fs');const assert=require('node:assert/strict');
const{initializeTestEnvironment,assertSucceeds}=require('@firebase/rules-unit-testing');
const{doc,setDoc,getDoc,serverTimestamp}=require('firebase/firestore');
(async()=>{
 for(const [label,rules]of[['1.1.0/1.1.1','tests/fixtures/firestore-1.1.rules'],['1.2.x/1.3.0','firestore.rules']]){
  const env=await initializeTestEnvironment({projectId:'demo-lunivo',firestore:{host:'127.0.0.1',port:8787,rules:fs.readFileSync(rules,'utf8')}});
  try{await env.clearFirestore();const db=env.authenticatedContext('compat').firestore();
   const profile={id:'ana',revision:'profile-1',deleted:false,updatedAt:serverTimestamp(),record:{id:'ana',name:'Ana',active:true}};
   await assertSucceeds(setDoc(doc(db,'users','compat','profiles','ana'),profile));
   const record={id:'one',client:'Cliente Lunivo',phone:'+50371234567',model:'Galaxy',channel:'WhatsApp',payment:'Contado',event:'Seguimiento',when:'2030-12-01T10:00',state:'Pendiente',contactProfile:'',notes:'',createdById:'ana',createdByName:'Ana',createdAt:'2030-10-01T12:00:00Z'};
   assert.equal(Object.hasOwn(record,'brand'),false);
   const ref=doc(db,'users','compat','followups','one');
   const value={id:'one',revision:'one-1',deleted:false,updatedAt:serverTimestamp(),record};
   await assertSucceeds(setDoc(ref,value));await assertSucceeds(getDoc(ref));
   await assertSucceeds(setDoc(ref,{...value,revision:'one-2',record:{...record,state:'Completado',notes:'Editado'}}));
   assert.equal((await getDoc(ref)).data().record.createdByName,'Ana');
   await assertSucceeds(setDoc(ref,{id:'one',revision:'deleted',deleted:true,updatedAt:serverTimestamp()}));
   console.log('PASS compatibilidad de reglas '+label+': usuarios, alta sin marca, edición/completar con autor y eliminación lógica');
  }finally{await env.cleanup()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
