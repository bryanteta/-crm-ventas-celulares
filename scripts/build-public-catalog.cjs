#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const catalog=require('./catalog-core.cjs');
const {buildCatalog}=catalog;
if (require.main===module) {
  const [input,output]=process.argv.slice(2);
  if (!input || !output) throw Error('Uso: node scripts/build-public-catalog.cjs CAPTURA_PRIVADA SALIDA_PUBLICA');
  const catalog=buildCatalog(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const temporary=output+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(catalog,null,2)+'\n');
  fs.renameSync(temporary,output);
  console.log(`Catálogo público guardado: ${catalog.products.length} variantes.`);
}
module.exports=catalog;
