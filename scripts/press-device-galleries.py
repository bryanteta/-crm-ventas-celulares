#!/usr/bin/env python3
"""Collect released product views from Samsung's public media archive."""
import argparse
import concurrent.futures
import datetime
import hashlib
import importlib.util
import json
import pathlib
import re
ROOT=pathlib.Path(__file__).resolve().parent.parent

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def parse(s):
    text=''
    for m in re.finditer(r'self\.__next_f\.push\(',s):
        try:
            a,_=json.JSONDecoder().raw_decode(s[m.end():])
            if len(a)>1 and isinstance(a[1],str):text+=a[1]
        except ValueError:pass
    def find(o):
        if isinstance(o,dict):
            if isinstance(o.get('images'),dict) and isinstance(o['images'].get('rows'),list):return o['images']
            for v in o.values():
                r=find(v)
                if r:return r
        elif isinstance(o,list):
            for v in o:
                r=find(v)
                if r:return r
    for line in text.splitlines():
        if re.match(r'^[a-f0-9]+:[\[{]',line):
            try:
                r=find(json.loads(line.split(':',1)[1]))
                if r:return r
            except ValueError:pass
    return {}

def matching_views(rows,model,finish):
    token=re.sub('[^a-z0-9]','',finish.lower())
    if 'bespoke' in token:return []  # Combination and frame must be documented exactly.
    model_token=re.sub('[^a-z0-9]','',model.lower().replace('samsung','galaxy'))
    selected=[];seen=set()
    for row in rows:
        item=row.get('item',{});name=item.get('filename','').lower();clean=re.sub('[^a-z0-9]','',name)
        if item.get('isPublic') is not True or model_token not in clean or token not in clean or not name.endswith(('.jpg','.png')):continue
        if any(word in name for word in ['pen','combo','lifestyle','ecosystem','all_color','series','kv_']):continue
        release=item.get('embargoTime')
        if release:
            try:
                date=datetime.datetime.fromisoformat(release.replace('Z','+00:00'))
                if date.replace(tzinfo=date.tzinfo or datetime.timezone.utc)>datetime.datetime.now(datetime.timezone.utc):continue
            except ValueError:continue
        poses=[('front_l30','Vista frontal izquierda'),('front_r30','Vista frontal derecha'),('back_l30','Vista posterior izquierda'),('back_r30','Vista posterior derecha'),('l_side','Lateral izquierdo'),('r_side','Lateral derecho'),('back','Reverso'),('front','Frente')]
        pose=next((label for marker,label in poses if marker in name),None)
        if not pose or pose in seen:continue
        url=item.get('imageUrl','')
        if not url.startswith('https://api.samsungmobilepress.com/api/v1/file/'):continue
        seen.add(pose);selected.append({'sourceImage':url,'sourceAssetName':item['filename'],'label':pose})
    return selected[:8]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--metadata-dir',type=pathlib.Path);args=parser.parse_args()
    d=module('d','discover-catalog-images.py');f=module('f','fetch-catalog-images.py');g=module('g','fetch-catalog-galleries.py')
    path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text());products=manifest['products']
    slugs={'Samsung S21 Ultra':'galaxy-s21-ultra','Samsung S22 Ultra':'galaxy-s22-ultra','Samsung Z Flip 4':'galaxy-z-flip4'}
    targets={}
    for key,item in products.items():
        actual=sum(a.get('label')!='Vista general en alta resolución' for a in item.get('gallery',[]))
        if item['model'] in slugs and actual<4:targets.setdefault(item['model'],[]).append((key,item))
    tasks=[]
    for model,items in targets.items():
        slug=slugs[model];cache=args.metadata_dir/('lunivo-press-'+slug+'.json') if args.metadata_dir else None
        source='https://www.samsungmobilepress.com/media-assets/'+slug
        try:
            if cache and cache.exists():rows=json.loads(cache.read_text())
            else:
                first=parse(d.read(source+'?category=Product&page=1'));rows=list(first.get('rows',[]))
                for page in range(2,min(first.get('totalPageCount',1),12)+1):rows.extend(parse(d.read(source+'?category=Product&page='+str(page))).get('rows',[]))
            for key,item in items:
                for art in matching_views(rows,model,item.get('officialColor','')):
                    if any(a.get('sourceAssetName')==art['sourceAssetName'] for a in item.get('gallery',[])) or art['sourceImage'] in item.get('galleryRejectedSources',[]):continue
                    tasks.append((key,{**art,'model':model,'color':item['color'],'sourcePage':source,'credit':'Samsung Mobile Press'}))
        except Exception:print('Samsung media archive pending:',model)
    def save(task):
        key,art=task
        try:
            _,saved=f.download((key+' press '+hashlib.sha256(art['sourceAssetName'].encode()).hexdigest()[:10],art));return key,saved
        except Exception:return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=[r for r in pool.map(save,tasks) if r]
    added=0
    for key,art in results:
        parent=products[key];reference=next((a for a in parent.get('gallery',[]) if a.get('label')=='Vista general en alta resolución'),parent)
        previous=[reference]+parent.get('gallery',[])
        if any(g.repeated_photo(a,art) for a in previous):
            parent.setdefault('galleryRejectedSources',[]).append(art['sourceImage']);(ROOT/'catalogo'/art['path']).unlink(missing_ok=True)
        else:parent.setdefault('gallery',[]).append(art);added+=1
    if results:path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Distinct released Samsung press views added:',added)

if __name__=='__main__':main()
