'use strict';
// Capture the manufacturer's own 3D model using its original viewer controls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assetRoot=path.resolve(process.argv[2]||'/tmp/lunivo-bespoke-capture'),sources=require('./bespoke-render-sources.json');
for(const [name,asset]of Object.entries(sources.files))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(assetRoot,name))).digest('hex')!==asset.sha256)throw Error('Original manufacturer model/viewer verification failed');
const markup=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#stage{width:1000px;height:1000px;position:relative}</style><div id="stage"></div><script src="v3d.js"></script><script src="FlipViewer.js"></script><script>window.viewer=new StudioFlipViewer.FlipViewer(document.getElementById('stage'),{viewport:'PC'});window.captureReady=viewer.setColor({frontGlass:'white',backGlass:'white',frame:'silver'});</script>`;
const poses=[{key:'half-open',label:'Semiplegado · vista lateral',mode:2},{key:'open-front',label:'Abierto · frente',mode:3,angle:'front'},{key:'closed-front',label:'Plegado · vista frontal',mode:1,angle:'front',roll:Math.PI},{key:'closed-back',label:'Plegado · vista posterior',mode:1,angle:'back',roll:Math.PI}];
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/viewer/index.html'){res.setHeader('Content-Type','text/html');res.end(markup);return;}const file=path.resolve(assetRoot,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(assetRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const captures=[];
 try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(sources.files['viewer/draco_decoder.js'].url,r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(assetRoot,'viewer/draco_decoder.js')),headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/viewer/index.html');await page.evaluate(()=>captureReady);await page.waitForFunction(()=>viewer.currentModel&&viewer.controller);
 for(const [color,name] of [['white','Blanco'],['yellow','Amarillo']]){
  await page.evaluate(async color=>{await viewer.setColor({frontGlass:color,backGlass:color,frame:'silver'});viewer.screenToggleOff();},color);
  for(const pose of poses){
   await page.evaluate(p=>{viewer.changeMode(p.mode,true);viewer.screenToggleOff();},pose);await page.waitForTimeout(850);
   if(pose.angle){await page.evaluate(p=>viewer.changeAngle(p.angle),pose);await page.waitForTimeout(850);}
   if(pose.roll){await page.evaluate(roll=>viewer.setPosition({angleZ:roll},0,undefined,true),pose.roll);await page.waitForTimeout(150);}
   await page.evaluate(()=>viewer.screenUpdate());await page.waitForTimeout(150);
   const relative='assets/products/samsung-z-flip-4-'+name.toLowerCase()+'-studio-'+pose.key+'.png';await page.locator('#stage').screenshot({path:path.join(root,'catalogo',relative)});
   captures.push({model:'Samsung Z Flip 4',color:name,path:relative,label:pose.label,sourcePage:sources.sourcePage,sourceType:'manufacturer-3d-view',credit:'Samsung Bespoke Studio',sourceRender:{model:sources.files['assets/models/b4-studio-v2-cp.glb'],renderer:sources.files['viewer/FlipViewer.js'],frontGlass:color,backGlass:color,frame:'silver',screen:'off',pose},sourceImage:sources.sourcePage+'#studio-'+color+'-'+pose.key});
  }
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(assetRoot,'captures.json'),JSON.stringify(captures,null,2)+'\n');console.log('Manufacturer studio views captured:',captures.length);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
