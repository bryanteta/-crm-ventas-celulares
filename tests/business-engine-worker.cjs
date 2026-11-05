const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');const readline=require('node:readline');
module.exports=()=>{
 const root=path.resolve(__dirname,'..'),jar=process.env.LUNIVO_JSON_JAR||'/workspace/firebase-emulator/platform/cloud-firestore-emulator/cloud-firestore-emulator.jar';
 if(!fs.existsSync(jar))throw Error('Define LUNIVO_JSON_JAR con el JAR del emulador de Firestore o de org.json.');
 const javaHome=process.env.JAVA_HOME||(fs.existsSync('/workspace/android-tools/jdk-21.0.8+9/bin/java')?'/workspace/android-tools/jdk-21.0.8+9':null),bin=name=>javaHome?path.join(javaHome,'bin',name):name;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-business-engine-'));
 const sources=['android/app/src/main/java/com/crmcelulares/app/BusinessEngine.java','android/app/src/test/java/com/crmcelulares/app/BusinessEngineCli.java'].map(p=>path.join(root,p));
 const compiled=spawnSync(bin('javac'),['-proc:none','-encoding','UTF-8','--release','17','-cp',jar,'-d',directory,...sources],{encoding:'utf8'});if(compiled.status!==0)throw Error(compiled.stderr);
 const child=spawn(bin('java'),['-cp',directory+path.delimiter+jar,'com.crmcelulares.app.BusinessEngineCli'],{stdio:['pipe','pipe','inherit']}),pending=new Map();let sequence=0;
 readline.createInterface({input:child.stdout}).on('line',line=>{const result=JSON.parse(line),p=pending.get(result.request);if(p){pending.delete(result.request);p.resolve(result);}});
 child.on('exit',code=>{for(const p of pending.values())p.reject(Error('Java engine exited '+code));pending.clear();});
 return{call(input){return new Promise((resolve,reject)=>{const request=++sequence;pending.set(request,{resolve,reject});child.stdin.write(JSON.stringify({...input,request})+'\n');});},close(){child.kill();fs.rmSync(directory,{recursive:true,force:true});}};
};
