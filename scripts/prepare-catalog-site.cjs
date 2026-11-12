'use strict';
// Publish only the public catalog; the Android/CRM source stays out of the site.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'catalogo');
const output=path.resolve(process.argv[2]||path.join(root,'_catalog_site'));
if(fs.existsSync(output))throw Error('Use a new output directory; refusing to overwrite existing files.');
const entries=['index.html','catalog.js','styles.css','hero.css','theme.css','theme.js','inventory.json','inventory-source.json','product-images.json','payment-plans.json','assets'];
function safeCopy(from,to){
 const stat=fs.lstatSync(from);
 if(stat.isSymbolicLink())throw Error('Symlinks are not allowed in the public site.');
 if(stat.isDirectory()){
  fs.mkdirSync(to,{recursive:true});
  for(const child of fs.readdirSync(from))safeCopy(path.join(from,child),path.join(to,child));
 }else if(stat.isFile())fs.copyFileSync(from,to);
 else throw Error('Unexpected public file type.');
}
fs.mkdirSync(output,{recursive:true});
for(const entry of entries)safeCopy(path.join(source,entry),path.join(output,entry));
// Keep existing /catalogo/ links and open tabs working after moving to the root.
fs.mkdirSync(path.join(output,'catalogo'));
for(const entry of entries)safeCopy(path.join(source,entry),path.join(output,'catalogo',entry));
fs.writeFileSync(path.join(output,'catalogo','index.html'),`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo Lunivo</title><link rel="canonical" href="../"><meta http-equiv="refresh" content="0; url=../">
<script>location.replace('../' + location.search + location.hash);</script></head>
<body><p><a href="../">Abrir el catálogo de Lunivo</a></p></body></html>\n`);
fs.writeFileSync(path.join(output,'.nojekyll'),'');
console.log('Public catalog prepared at root; legacy links redirect to root.');
