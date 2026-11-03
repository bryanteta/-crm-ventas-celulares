// Real prior APK web assets are served at the SAME origin, then replaced by the new assets.
// This validates durable WebView-style data formats; it is not an installed Android APK update.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const version of['1.1.1','1.2.1'])for(const account of[false,true]){
  const context=await browser.newContext({viewport:{width:412,height:915},timezoneId:'America/El_Salvador'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await require('./profile-fixture.cjs').installProfile(page);
  const root='/workspace/android-tools/upgrade-fixtures/'+version;
  await context.route('http://127.0.0.1:8000/**',async route=>{const uri=new URL(route.request().url());const relative=uri.pathname==='/'?'index.html':uri.pathname.slice(1);const file=path.resolve(root,relative);if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())await route.fulfill({path:file,headers:{'cache-control':'no-store'}});else await route.continue();});
  await page.goto('http://127.0.0.1:8000/');
  for(let i=0;i<(version==='1.2.1'?2:1);i++){
   await page.locator('nav a[href="#registro"]').click();
   for(const[field,value]of Object.entries({client:'Cliente '+version+' '+i,phone:'7123456'+i,model:'Galaxy',when:'2030-12-01T10:00',notes:'Información conservada ñ\nSegunda línea'}))await page.locator(`#form [name=${field}]`).fill(value);
   if(version==='1.2.1')await page.locator('#form [name=brand]').selectOption(i===0?'Split':'Lunivo');
   await page.locator('#form [type=submit]').click();await page.locator('#listado').waitFor();
  }
  if(account)await page.evaluate(()=>{const rows=LunivoApp.records(),profiles=LunivoProfiles.legacyRecords();LunivoProfiles.switchAccount('upgrade-user',profiles);LunivoStore.switchAccount('upgrade-user',rows);LunivoApp.reload(true);localStorage.setItem('lunivo-active-brand-v1:upgrade-user','Split');});
  const expected=await page.evaluate(()=>({records:LunivoApp.records(),pending:LunivoStore.pending(),profiles:LunivoProfiles.records(),profilePending:LunivoProfiles.pending()}));
  await context.unrouteAll();await page.reload();
  assert.equal(await page.locator('#brand-filter,[name=brand],[data-brand-target]').count(),0);
  assert.deepEqual(await page.evaluate(()=>LunivoApp.records()),expected.records);
  assert.deepEqual(await page.evaluate(()=>LunivoStore.pending()),expected.pending);
  assert.deepEqual(await page.evaluate(()=>LunivoProfiles.records()),expected.profiles);
  assert.deepEqual(await page.evaluate(()=>LunivoProfiles.pending()),expected.profilePending);
  await page.locator('nav a[href="#listado"]').click();assert.equal(await page.locator('#items .row').count(),expected.records.length);
  await page.locator('#items .row').first().getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#form [name=notes]').fill('Editado después de actualizar');await page.locator('#form [type=submit]').click();await page.locator('#listado').waitFor();
  const first=await page.evaluate(id=>LunivoApp.records().find(r=>r.id===id),expected.records[0].id);
  for(const key of['id','createdById','createdByName','createdAt','brand'])assert.equal(first[key],expected.records[0][key]);
  assert.equal(first.notes,'Editado después de actualizar');
  assert.deepEqual(errors,[]);console.log('PASS actualización de assets '+version+' → 1.3.0, '+(account?'cuenta con cola pendiente':'modo local')+': datos, perfiles, autor y cola conservados; todos los registros visibles y editables');await context.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
