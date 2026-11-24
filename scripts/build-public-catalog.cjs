#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const catalog=require('./catalog-core.cjs');
const {buildCatalog}=catalog;
if (require.main===module) {
  const [input,output]=process.argv.slice(2);
  if (!input || !output) throw Error('Uso: node scripts/build-public-catalog.cjs CAPTURA_PRIVADA SALIDA_PUBLICA');
  const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null;
  const skipped=[];
  const catalog=buildCatalog(JSON.parse(fs.readFileSync(input,'utf8')),Date.now(),previous,skipped);
  // GitHub Actions shows these as annotations on the run summary.
  for(const {provider,model} of skipped)console.log(`::warning title=Modelo no reconocido::Se omitió "${model.replace(/[\r\n%]/g,' ')}" (${provider === 'samuel' ? 'TecnoShop' : 'Split'}). Agrega el modelo en catalog-identity.js para publicarlo.`);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const temporary=output+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(catalog,null,2)+'\n');
  fs.renameSync(temporary,output);
  console.log(`Catálogo público guardado: ${catalog.products.length} variantes.`);
}
module.exports=catalog;
