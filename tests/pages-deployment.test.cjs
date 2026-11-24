'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {deployPages}=require('../scripts/deploy-pages-rest.cjs');
const http=status=>Object.assign(Error('Private request body must not be logged'),{status});
function fixture({artifact={},metadataErrors=[],statuses=['deployment_in_progress','succeed'],createError}={}){
  const calls=[],logs=[],outputs={},masked=[];let pauses=0,tokenCalls=0;
  const args={repo:{owner:'owner',repo:'repo'},runId:'7',artifactId:'42',buildVersion:'a'.repeat(40),attempts:3,
    pause:async()=>{pauses++;},core:{info:message=>logs.push(message),warning:message=>logs.push(message),setSecret:value=>masked.push(value),getIDToken:async()=>{tokenCalls++;return 'private-token';},setOutput:(key,value)=>{outputs[key]=value;}},
    github:{request:async(route,params)=>{
      calls.push({route,params});
      if(route.includes('/actions/artifacts/')){if(metadataErrors.length)throw http(metadataErrors.shift());return {data:{id:42,name:'github-pages',expired:false,workflow_run:{id:7},...artifact}};}
      if(route==='POST /repos/{owner}/{repo}/pages/deployments'){if(createError)throw http(createError);return {data:{id:'deployment-1',page_url:'https://lunivosv.com/'}};}
      if(route.endsWith('/cancel'))return {data:{}};
      const state=statuses.length>1?statuses.shift():statuses[0];
      if(typeof state==='number')throw http(state);
      return {data:{status:state}};
    }}
  };
  return {args,calls,logs,outputs,masked,get pauses(){return pauses;},get tokenCalls(){return tokenCalls;}};
}
test('publishes the exact uploaded ID, masks OIDC, and only reports success after Pages confirms it',async()=>{
  const f=fixture();await deployPages(f.args);
  const creation=f.calls.filter(c=>c.route==='POST /repos/{owner}/{repo}/pages/deployments');assert.equal(creation.length,1);
  assert.equal(creation[0].params.artifact_id,42);assert.equal(creation[0].params.pages_build_version,'a'.repeat(40));assert.equal(creation[0].params.oidc_token,'private-token');
  assert.equal(f.outputs.page_url,'https://lunivosv.com/');assert.equal(f.outputs.status,'succeed');assert.equal(f.pauses,1);assert.deepEqual(f.masked,['private-token']);
  assert(!f.logs.join('\n').includes('private-token'));
});
test('refuses expired artifacts, another run, a wrong name or another upload ID before obtaining a token',async()=>{
  for(const artifact of [{expired:true},{workflow_run:{id:6}},{name:'other'},{id:41}]){
    const f=fixture({artifact});await assert.rejects(deployPages(f.args),/no pertenece/);assert.equal(f.tokenCalls,0);assert.equal(f.calls.length,1);
  }
});
test('retries delayed metadata and transient polling errors without repeating deployment creation',async()=>{
  const f=fixture({metadataErrors:[404,503],statuses:[502,'deployment_in_progress','succeed']});await deployPages(f.args);
  assert.equal(f.calls.filter(c=>c.route==='POST /repos/{owner}/{repo}/pages/deployments').length,1);assert.equal(f.outputs.status,'succeed');assert.equal(f.pauses,4);
});
test('keeps real content and permissions failures red rather than claiming success',async()=>{
  for(const status of ['deployment_failed','deployment_perms_error','deployment_content_failed','deployment_cancelled','deployment_lost']){
    const f=fixture({statuses:[status]});await assert.rejects(deployPages(f.args),new RegExp(status));assert.equal(f.outputs.status,undefined);
  }
});
test('bounds polling and cancels a deployment that never finishes',async()=>{
  const f=fixture({statuses:['deployment_in_progress']});await assert.rejects(deployPages(f.args),/a tiempo/);assert.equal(f.calls.filter(c=>c.route.endsWith('/cancel')).length,1);assert.equal(f.pauses,2);assert.equal(f.outputs.status,undefined);
});
test('does not blindly retry a failed creation or expose request details',async()=>{
  const f=fixture({createError:502});await assert.rejects(deployPages(f.args),error=>error.message==='La API de Pages respondió HTTP 502.');
  assert.equal(f.calls.filter(c=>c.route.startsWith('POST ')).length,1);assert.equal(f.outputs.status,undefined);
});
test('invalid input cannot call an API',async()=>{
  for(const patch of [{artifactId:''},{runId:'invalid'},{buildVersion:'main'}]){const f=fixture();await assert.rejects(deployPages({...f.args,...patch}),/inválidos/);assert.equal(f.calls.length,0);}
});
test('the workflow uses the upload ID and the checked-out commit without the stale Twirp listing',()=>{
  const text=require('node:fs').readFileSync('.github/workflows/deploy-catalog.yml','utf8');
  assert(text.includes('actions/github-script@v8'));assert(!text.includes('uses: actions/deploy-pages@'));assert(text.includes('steps.upload.outputs.artifact_id'));assert(text.includes('git rev-parse HEAD'));assert(text.includes('scripts/deploy-pages-rest.cjs'));
});
