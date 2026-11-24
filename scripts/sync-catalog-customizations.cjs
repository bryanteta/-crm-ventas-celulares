'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),custom=require('../catalogo/customization-core.js');
function atomic(file,text){
 const temporary=file+'.tmp';
 try{fs.writeFileSync(temporary,text);fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary)&&fs.statSync(temporary).isFile())fs.unlinkSync(temporary);}
}
function sync(body,file,{allowReset=false,backupDir=path.join(path.dirname(file),'backups')}={}){
 const next=custom.state(JSON.parse(body)),old=fs.existsSync(file)?custom.state(JSON.parse(fs.readFileSync(file,'utf8'))):custom.empty();
 const before=Object.keys(old.overrides).length,after=Object.keys(next.overrides).length;
 // Keep a restorable, public-only copy outside the published site before a
 // replacement. Failure to preserve it must leave the existing snapshot intact.
 if(before&&JSON.stringify(old)!==JSON.stringify(next)){
  fs.mkdirSync(backupDir,{recursive:true});const text=JSON.stringify(old,null,2)+'\n',hash=createHash('sha256').update(text).digest('hex');
  const archive=path.join(backupDir,old.revision+'-'+hash+'.json');if(!fs.existsSync(archive))atomic(archive,text);
 }
 if(before&&!allowReset&&(next.revision<old.revision||after===0||after<before/2)){
  throw Object.assign(Error('Se conserva el respaldo anterior. Confirma el reinicio o la reducción masiva con allow_customization_reset en la ejecución manual.'),{code:'RESET_REQUIRES_CONFIRMATION'});
 }
 atomic(file,JSON.stringify(next,null,2)+'\n');return next;
}
if(require.main===module){
 try{sync(fs.readFileSync(0,'utf8'),process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'catalogo/customizations.json',{allowReset:process.argv.includes('--allow-reset'),backupDir:path.resolve('backups/catalog-customizations')});console.log('Ediciones públicas sincronizadas.');}
 catch(error){console.error(error.code==='RESET_REQUIRES_CONFIRMATION'?'RESET_REQUIRES_CONFIRMATION':'No se pudo sincronizar; se conserva el respaldo anterior.');process.exitCode=1;}
}
module.exports={sync};
