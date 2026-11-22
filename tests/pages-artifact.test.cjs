'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {waitForArtifact}=require('../scripts/wait-pages-artifact.cjs');
const artifact=id=>({id,name:'github-pages',expired:false});
test('waits through delayed visibility and an API error for the current upload',async()=>{
  let calls=0,pauses=0;
  await waitForArtifact({expectedId:'42',list:()=>{calls++;if(calls===1)return {artifacts:[]};if(calls===2)throw Error('temporary API error');return {artifacts:[artifact(42)]};},pause:async()=>{pauses++;},log:()=>{}});
  assert.equal(calls,3);assert.equal(pauses,2);
});
test('refuses missing, old, expired or ambiguous artifacts after a bounded wait',async()=>{
  for(const artifacts of [[],[artifact(41)],[{...artifact(42),expired:true}],[artifact(41),artifact(42)]]){
    let calls=0,pauses=0;
    await assert.rejects(waitForArtifact({expectedId:'42',attempts:3,list:()=>{calls++;return {artifacts};},pause:async()=>{pauses++;},log:()=>{}}),/conserva el sitio/);
    assert.equal(calls,3);assert.equal(pauses,2);
  }
});
test('fails before querying if the upload ID is missing',async()=>{
  await assert.rejects(waitForArtifact({list:()=>{throw Error('must not query');}}),/identificador/);
});
