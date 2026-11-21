'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),{initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,runTransaction,serverTimestamp}=require('firebase/firestore');const createEngine=require('./business-engine-worker.cjs');
(async()=>{const env=await initializeTestEnvironment({projectId:'demo-lunivo',firestore:{host:'127.0.0.1',port:8787,rules:fs.readFileSync('firestore.rules','utf8')}});const engine=createEngine(),uid='mixed-payments',db=env.authenticatedContext(uid).firestore(),id=Buffer.from('sale').toString('base64url');
 async function execute(op,tamper=false){return runTransaction(db,async tx=>{const documents={};for(let n=0;n<20;n++){const r=await engine.call({uid,operation:op,now:new Date().toISOString(),documents});if(r.need){const snap=await tx.get(doc(db,r.need));documents[r.need]=snap.exists()?snap.data():null;continue;}if(r.error)throw Error(r.error);for(const[path,value]of Object.entries(r.writes)){if(value.updatedAt)value.updatedAt=serverTimestamp();if(path.includes('/suiteOperations/'))value.createdAt=serverTimestamp();if(tamper&&path.includes('/suiteSales/'))value.record.receipt.paymentAdvance=value.record.revenue+1;tx.set(doc(db,path),value);}return r.result;}throw Error('Too many reads');});}
 const command=(key,kind,values,revision)=>({id:key,kind,targetId:'sale',actor:{id:'ana',name:'Ana'},values,...(revision?{expectedRevision:revision}:{})});
 try{
 await env.clearFirestore();
 await setDoc(doc(db,'users',uid,'profiles',Buffer.from('ana').toString('base64url')),{id:'ana',record:{id:'ana',name:'Ana',active:true},revision:'seed',deleted:false,updatedAt:serverTimestamp()});
 const receipt={version:1,number:'',deliveryDate:'2026-11-05',brand:'Apple',capacity:'128 GB',color:'Negro',condition:'Seminuevo',battery:'100%',physical:'Sin daños visibles',serials:[],phone:'',paymentMethod:'Tasa cero',bank:'Banco Cuscatlán',months:12,warrantyMonths:3,terms:['Uno','Dos','Tres'],gifts:[],paymentAdvance:10000,advanceMethod:'Efectivo'};
 const sale={id:'sale',client:'Cliente',model:'iPhone 14',date:'2026-11-05',quantity:1,price:45000,cost:35000,expenses:0,accessories:0,accessoryCost:0,revenue:45000,purchase:35000,profit:10000,commission:0,commissionEnabled:false,status:'Confirmada',stockId:'',offerId:'',paidAt:null,sellerId:'ana',sellerName:'Ana',createdAt:new Date().toISOString(),receipt};
 console.log('confirm');await execute(command('confirm','confirmSale',{sale}));
 console.log('edit');await execute(command('edit','editSale',{patch:{receipt:{...receipt,paymentAdvance:15000,advanceMethod:'Transferencia',advanceBank:'Banco Agrícola'}}},'confirm'));
 let row=(await getDoc(doc(db,'users',uid,'suiteSales',id))).data().record;a.equal(row.revenue,45000);a.equal(row.receipt.paymentAdvance,15000);a.equal(row.receipt.advanceMethod,'Transferencia');a.equal(row.receipt.advanceBank,'Banco Agrícola');
 await assertFails(execute(command('tamper','editSale',{patch:{receipt:{...receipt,paymentAdvance:20000}}},'edit'),true));
 console.log('warranty');await execute(command('warranty','saveWarranty',{receipt:{...row.receipt,paymentAdvance:20000}},'edit'));
 row=(await getDoc(doc(db,'users',uid,'suiteSales',id))).data().record;a.equal(row.receipt.paymentAdvance,20000);a.equal(row.revenue,45000);
 await execute(command('price-edit','editSale',{patch:{price:46000,receipt:{...row.receipt,paymentAdvance:21000}}},'warranty'));
 row=(await getDoc(doc(db,'users',uid,'suiteSales',id))).data().record;a.equal(row.revenue,46000);a.equal(row.receipt.paymentAdvance,21000);
 console.log('PASS: confirmación, edición y garantía mixta sincronizadas; reglas rechazan abono mayor al total sin alterar la venta.');
 }finally{engine.close();await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
