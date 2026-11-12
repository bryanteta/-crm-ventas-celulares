import {collectCatalog,INTERVAL} from './service.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','X-Content-Type-Options':'nosniff'};
const unavailable=()=>new Response(JSON.stringify({error:'Catálogo temporalmente no disponible'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});

// SQLite-backed objects are available on Cloudflare's free plan. Only the
// sanitized public snapshot is stored; provider responses and secrets stay out.
export class CatalogStore{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.inflight=null;
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.latest=this.read('public');this.attempt=Number(this.read('attempt')||0);
  }
  read(key){return this.ctx.storage.sql.exec('SELECT data FROM snapshots WHERE id = ?',key).toArray()[0]?.data||null;}
  write(key,value){this.ctx.storage.sql.exec('INSERT INTO snapshots (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',key,value);}
  async refresh(scheduled=false){
    if(this.inflight)return this.inflight;
    if(!scheduled&&Date.now()-this.attempt<INTERVAL)return Boolean(this.latest);
    this.attempt=Date.now();this.write('attempt',String(this.attempt));
    this.inflight=(async()=>{
      try{
        const output=await collectCatalog(this.env.SPLIT_INVENTORY_TOKEN),body=JSON.stringify(output);
        if(new TextEncoder().encode(body).byteLength>1024*1024)throw Error('Public snapshot too large');
        this.write('public',body);this.latest=body;return true;
      }catch{return false;} // Never log raw responses, keys or supplier prices.
      finally{this.inflight=null;}
    })();
    return this.inflight;
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/refresh'&&request.method==='POST')return new Response(null,{status:await this.refresh(true)?204:503});
    if(path==='/health')return Response.json({ready:Boolean(this.latest),configured:Boolean(this.env.SPLIT_INVENTORY_TOKEN?.trim()),updatedAt:this.latest?JSON.parse(this.latest).updatedAt:null,attemptedAt:this.attempt?new Date(this.attempt).toISOString():null},{headers:{...headers,'Cache-Control':'no-store'}});
    if(path!=='/inventory.json'||!['GET','HEAD'].includes(request.method))return new Response(null,{status:404});
    if(!this.latest)await this.refresh();
    else if(Date.now()-Date.parse(JSON.parse(this.latest).updatedAt)>=INTERVAL&&Date.now()-this.attempt>=INTERVAL)this.ctx.waitUntil(this.refresh());
    return this.latest?new Response(request.method==='HEAD'?null:this.latest,{headers:{...headers,'Cache-Control':'public, max-age=30'}}):unavailable();
  }
}
function store(env){return env.CATALOG.get(env.CATALOG.idFromName('public-inventory'));}
export default{
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==='/')return Response.json({service:'Lunivo',inventory:'/inventory.json',status:'/health'},{headers});
    if(!['/inventory.json','/health'].includes(path))return new Response(null,{status:404});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD, OPTIONS'}});
    try{
      const response=await store(env).fetch(new Request('https://catalog.internal'+path,{method:request.method}));
      if(path==='/health'){const report=await response.json();return Response.json({...report,workerConfigured:Boolean(env.SPLIT_INVENTORY_TOKEN?.trim()),revision:'secret-check-2'},{headers:{...headers,'Cache-Control':'no-store'}});}
      return response;
    }catch{return unavailable();}
  },
  scheduled(event,env,ctx){ctx.waitUntil(store(env).fetch(new Request('https://catalog.internal/refresh',{method:'POST'})).then(r=>{if(!r.ok)console.error('Catalog refresh failed; previous public snapshot retained.');}));}
};
