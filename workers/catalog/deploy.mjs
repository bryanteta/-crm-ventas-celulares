import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const cli=fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js',import.meta.url));
export function deploy(env=process.env,run=spawnSync){
  const publish=run(process.execPath,[cli,'deploy'],{env,stdio:'inherit'});
  if(publish.status!==0)return publish.status||1;
  // A user may have entered the provider secret in Cloudflare's Build settings.
  // Only that account's production Build can synchronize its own secret into
  // runtime. Never copy a developer-machine environment secret to Cloudflare.
  const token=env.SPLIT_INVENTORY_TOKEN?.trim();
  if(env.WORKERS_CI==='1'&&env.WORKERS_CI_BRANCH==='main'&&token){
    const saved=run(process.execPath,[cli,'secret','put','SPLIT_INVENTORY_TOKEN'],{env,input:token+'\n',stdio:['pipe','inherit','inherit']});
    if(saved.status!==0)return saved.status||1;
  }
  return 0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=deploy();
