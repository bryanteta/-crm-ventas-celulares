'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),custom=require('../catalogo/customization-core.js');
function atomic(file,text){
 const temporary=file+'.tmp';
 try{fs.writeFileSync(temporary,text);fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary)&&fs.statSync(temporary).isFile())fs.unlinkSync(temporary);}
}
function prune(backupDir,keep){
 if(!fs.existsSync(backupDir))return;
 const files=fs.readdirSync(backupDir).filter(name=>/^\d+-[a-f0-9]{64}\.json$/.test(name)).map(name=>{
  const file=path.join(backupDir,name),stat=fs.lstatSync(file);if(!stat.isFile())return null;
  let date;try{date=Date.parse(JSON.parse(fs.readFileSync(file,'utf8')).updatedAt);}catch{}
  return {file,name,date:Number.isFinite(date)?date:stat.mtimeMs};
 }).filter(Boolean).sort((a,b)=>(Number(b.file===keep)-Number(a.file===keep))||b.date-a.date||b.name.localeCompare(a.name));
 for(const entry of files.slice(30))fs.unlinkSync(entry.file);
}
function sync(body,file,{allowReset=false,backupDir=path.join(path.dirname(file),'backups')}={}){
 const next=custom.state(JSON.parse(body)),old=fs.existsSync(file)?custom.state(JSON.parse(fs.readFileSync(file,'utf8'))):custom.empty();
 const before=Object.keys(old.overrides).length,after=Object.keys(next.overrides).length;
 let preserved;
 const reset=next.revision<old.revision||old.updatedAt!==null&&(next.updatedAt===null||Date.parse(next.updatedAt)<Date.parse(old.updatedAt));
 // Keep a restorable, public-only copy outside the published site before a
 // reduction or reset. Routine edits remain in Git history. Failure to archive
 // must leave the existing snapshot intact; the archive directory keeps 30 copies.
 if(before&&(reset||after<before)&&JSON.stringify(old)!==JSON.stringify(next)){
  fs.mkdirSync(backupDir,{recursive:true});const text=JSON.stringify(old,null,2)+'\n',hash=createHash('sha256').update(text).digest('hex');
  const archive=path.join(backupDir,old.revision+'-'+hash+'.json');if(!fs.existsSync(archive))atomic(archive,text);preserved=archive;
 }
 prune(backupDir,preserved);
 if(before&&!allowReset&&reset){
  throw Object.assign(Error('Se conserva el respaldo anterior. Confirma el reinicio de revisión o fecha con allow_customization_reset en la ejecución manual.'),{code:'RESET_REQUIRES_CONFIRMATION'});
 }
 atomic(file,JSON.stringify(next,null,2)+'\n');return next;
}
if(require.main===module){
 try{sync(fs.readFileSync(0,'utf8'),process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'catalogo/customizations.json',{allowReset:process.argv.includes('--allow-reset'),backupDir:path.resolve('backups/catalog-customizations')});console.log('Ediciones públicas sincronizadas.');}
 catch(error){console.error(error.code==='RESET_REQUIRES_CONFIRMATION'?'RESET_REQUIRES_CONFIRMATION':'No se pudo sincronizar; se conserva el respaldo anterior.');process.exitCode=1;}
}
module.exports={sync};
