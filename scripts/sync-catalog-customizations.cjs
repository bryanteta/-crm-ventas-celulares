'use strict';
const fs=require('node:fs'),custom=require('../catalogo/customization-core.js');
// The authenticated administration's public service is authoritative. Revision
// numbers are local to that service and can restart after storage recovery.
function sync(body,file){
 const state=custom.state(JSON.parse(body));
 const temporary=file+'.tmp';
 try{fs.writeFileSync(temporary,JSON.stringify(state,null,2)+'\n');fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 return state;
}
if(require.main===module){sync(fs.readFileSync(0,'utf8'),process.argv[2]||'catalogo/customizations.json');console.log('Ediciones públicas sincronizadas.');}
module.exports={sync};
