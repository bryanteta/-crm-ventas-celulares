'use strict';
const {execFileSync}=require('node:child_process');

// Artifact upload can finish before the Actions listing used by deploy-pages
// sees it. Require this upload's ID, never an artifact from an earlier attempt.
async function waitForArtifact({list,expectedId,attempts=12,pause=()=>new Promise(r=>setTimeout(r,5000)),log=console.log}){
  if(!/^\d+$/.test(String(expectedId)))throw Error('Falta el identificador del archivo recién subido.');
  for(let attempt=1;attempt<=attempts;attempt++){
    let artifacts=[];
    try{artifacts=list().artifacts.filter(a=>a.name==='github-pages'&&!a.expired);}catch{/* A temporary API failure is retried within the same bounded wait. */}
    if(artifacts.length===1&&String(artifacts[0].id)===String(expectedId)){
      log('Archivo de esta ejecución disponible para publicar.');return;
    }
    if(attempt<attempts){log(`Esperando el archivo de publicación (${attempt}/${attempts})…`);await pause();}
  }
  throw Error('GitHub todavía no permite localizar de forma inequívoca el archivo recién subido. Se conserva el sitio publicado.');
}
if(require.main===module){
  const {GITHUB_REPOSITORY:repo,GITHUB_RUN_ID:run,PAGES_ARTIFACT_ID:expectedId}=process.env;
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo||'')||!/^\d+$/.test(run||''))throw Error('Ejecución de GitHub inválida.');
  waitForArtifact({expectedId,list:()=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/actions/runs/${run}/artifacts?name=github-pages&per_page=100`],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}))}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={waitForArtifact};
