import feeds from '../../feeds-core.js';
import catalog from '../../scripts/catalog-core.cjs';

const SAMUEL='https://script.google.com/macros/s/AKfycbweF6GVeLUBF6zIiUuPS6CsVSzKyabDV1kHrXgehpmQKnXVa40yqGPw6ltA3fjebQCLxw/exec?fn=getCatalogo&a=%5B%5D';
const SPLIT='https://split-crm.splitelsalvador.workers.dev/api/v1/inventario';
export const INTERVAL=5*60*1000;
const MAX_BYTES=4*1024*1024;
async function readProvider(url,headers,fetcher,google=false){
  for(let redirect=0;redirect<=4;redirect++){
    const response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(response.status>=300&&response.status<400){
      await response.body?.cancel();
      const next=new URL(response.headers.get('location'),url);
      if(!google||next.protocol!=='https:'||!['script.google.com','script.googleusercontent.com'].includes(next.hostname)||redirect===4)throw Error('Invalid provider redirect');
      url=next.href;continue;
    }
    if(!response.ok)throw Error('Provider unavailable');
    if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Provider response too large');
    const reader=response.body.getReader(),chunks=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();throw Error('Provider response too large');}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return new TextDecoder().decode(bytes);
  }
}
export async function collectCatalog(token,{fetcher=fetch,now=Date.now}={}){
  if(typeof token!=='string'||!token.trim())throw Error('Provider secret missing');
  const [samuel,split]=await Promise.all([
    readProvider(SAMUEL,{Accept:'application/json'},fetcher,true),
    readProvider(SPLIT,{Accept:'application/json','X-API-Key':token},fetcher)
  ]);
  const checked=now();
  return catalog.buildCatalog({version:1,checkedAt:new Date(checked).toISOString(),providers:{samuel:feeds.samuelApi(samuel),split:feeds.split(split)}},checked);
}
