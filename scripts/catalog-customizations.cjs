'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),custom=require('../catalogo/customization-core.js');
function key(p){return createHash('sha256').update(custom.identity(p)).digest('hex').slice(0,32);}
function readCatalog(source){const catalog=JSON.parse(fs.readFileSync(path.join(source,'inventory.json'),'utf8')),file=path.join(source,'customizations.json');const state=fs.existsSync(file)?custom.state(JSON.parse(fs.readFileSync(file,'utf8'))):custom.empty();return {...catalog,products:catalog.products.map(p=>custom.apply(p,state.overrides[key(p)]))};}
module.exports={readCatalog,key};
