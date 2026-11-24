'use strict';

// upload-pages-artifact exposes its immutable artifact ID. Use that ID through
// the REST API throughout; deploy-pages' separate Twirp listing can lag behind.
async function deployPages({github,core,repo,runId,artifactId,buildVersion,attempts=60,pause=()=>new Promise(resolve=>setTimeout(resolve,5000))}){
  if(!/^\d+$/.test(String(artifactId))||!/^\d+$/.test(String(runId))||!Number.isSafeInteger(Number(artifactId))||!/^[a-f0-9]{40}$/.test(buildVersion||''))throw Error('Identificadores de publicación inválidos.');
  const params={owner:repo.owner,repo:repo.repo};
  const deadline=Date.now()+7*60*1000;
  async function request(route,extra){
    try{return (await github.request(route,{...params,...extra})).data;}
    catch(error){throw Object.assign(Error('La API de Pages respondió HTTP '+(error.status||'desconocido')+'.'),{status:error.status});}
  }
  // GETs may be retried safely; never blindly repeat a deployment creation.
  async function read(route,extra){
    for(let n=0;n<6;n++){
      if(Date.now()>=deadline)throw Error('Se agotó el plazo para consultar GitHub Pages.');
      try{return await request(route,extra);}catch(error){
        if(n===5||![404,429,500,502,503,504].includes(error.status))throw error;
        core.info('Esperando respuesta de GitHub…');await pause();
      }
    }
  }
  const artifact=await read('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}',{artifact_id:artifactId});
  if(String(artifact.id)!==String(artifactId)||artifact.name!=='github-pages'||artifact.expired||String(artifact.workflow_run?.id)!==String(runId))throw Error('El archivo no pertenece a esta ejecución. Se conserva el sitio publicado.');
  const token=await core.getIDToken();core.setSecret(token);
  const created=await request('POST /repos/{owner}/{repo}/pages/deployments',{artifact_id:Number(artifactId),pages_build_version:buildVersion,oidc_token:token});
  const deploymentId=created.id||created.status_url?.split('/').pop()||buildVersion;
  if(!/^[\w-]+$/.test(String(deploymentId)))throw Error('Identificador de despliegue inválido.');
  const terminal=new Set(['deployment_failed','deployment_perms_error','deployment_content_failed','deployment_cancelled','deployment_lost']);
  async function cancel(){
    try{await request('POST /repos/{owner}/{repo}/pages/deployments/{deploymentId}/cancel',{deploymentId});}
    catch{core.warning('No se pudo confirmar la cancelación del despliegue en GitHub.');}
  }
  for(let n=0;n<attempts;n++){
    if(Date.now()>=deadline)break;
    let result;
    try{result=await read('GET /repos/{owner}/{repo}/pages/deployments/{deploymentId}',{deploymentId});}
    catch(error){await cancel();throw error;}
    if(result.status==='succeed'){
      core.setOutput('page_url',created.page_url);core.setOutput('status','succeed');
      core.info('Publicación confirmada correctamente por GitHub Pages.');return;
    }
    if(terminal.has(result.status))throw Error('GitHub Pages terminó con estado '+result.status+'.');
    core.info('Pages está preparando la publicación.');
    if(n<attempts-1)await pause();
  }
  await cancel();throw Error('GitHub Pages no confirmó la publicación a tiempo; se solicitó cancelar el despliegue.');
}
module.exports={deployPages};
