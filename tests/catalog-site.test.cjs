'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),script=path.join(root,'scripts/prepare-catalog-site.cjs');
test('Pages artifact serves the same public catalog at root and legacy path without CRM or private configuration',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lunivo-site-test-'));
 try{
  const output=path.join(tmp,'site'),built=spawnSync(process.execPath,[script,output],{encoding:'utf8'});
  assert.equal(built.status,0,built.stderr);
  for(const file of ['index.html','inventory.json','payment-plans.json','product-images.json','catalog.js','styles.css']){
   const original=fs.readFileSync(path.join(root,'catalogo',file));
   assert.deepEqual(fs.readFileSync(path.join(output,file)),original);
   assert.deepEqual(fs.readFileSync(path.join(output,'catalogo',file)),original);
  }
  for(const excluded of ['android','app.js','app.css','suite.js','firestore.rules','.git','.github','docs'])assert.equal(fs.existsSync(path.join(output,excluded)),false);
  assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/id="products"/);
  assert.ok(fs.existsSync(path.join(output,'assets/logo.png')));
  assert.ok(fs.existsSync(path.join(output,'.nojekyll')));
  fs.writeFileSync(path.join(output,'keep.txt'),'preserve');
  const duplicate=spawnSync(process.execPath,[script,output],{encoding:'utf8'});
  assert.notEqual(duplicate.status,0);assert.equal(fs.readFileSync(path.join(output,'keep.txt'),'utf8'),'preserve');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
