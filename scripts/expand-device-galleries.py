#!/usr/bin/env python3
"""Complete model/color galleries from structured public product records."""
import argparse
import concurrent.futures
import html
import importlib.util
import json
import pathlib
import re
import urllib.parse
ROOT=pathlib.Path(__file__).resolve().parent.parent

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def norm(value):return re.sub('[^a-z0-9]','',str(value).lower())
def count(item):return 1+sum(g.get('label')!='Vista general en alta resolución' for g in item.get('gallery',[]))

def swappie_records(page,model,source):
    match=re.search(r'window\.__INITIAL__DATA__\s*=\s*(.*?);?\s*</script>',page,re.S)
    if not match:return {}
    data=json.loads(match[1].strip().rstrip(';')).get('productPageData',{})
    if norm(data.get('selectedProduct',{}).get('modelName',''))!=norm(model):return {}
    result={}
    for color in data.get('modelAvailabilityData',{}).get('colors',[]):
        records=[]
        for field,label in [('secondaryImage','Reverso'),('tertiaryImage','Frente')]:
            name=(color.get(field) or {}).get('imageLink','')
            if not re.fullmatch(r'[A-Za-z0-9_.-]+\.(?:png|jpg|webp)',name):continue
            if norm(model) not in norm(name) or norm(color.get('color','')) not in norm(name):continue
            records.append({'sourceImage':'https://assets.swappie.com/cdn-cgi/image/width=1200,height=1200,fit=contain,format=webp,quality=85/'+name,'sourcePage':source,'credit':'Swappie','label':label,'singleDevice':label=='Reverso' or norm(model) not in ['iphone13','iphone13mini']})
        result[norm(color.get('color',''))]=records
    return result

def refurbed_variants(page,model):
    result={};wanted=norm(model.replace('Samsung ','Samsung Galaxy '))
    for data in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',page,re.S):
        try:objects=json.loads(data)
        except ValueError:continue
        for obj in objects if isinstance(objects,list) else [objects]:
            if not isinstance(obj,dict) or obj.get('@type')!='ProductGroup' or norm(re.sub(r'\s+5G$','',obj.get('name',''),flags=re.I))!=wanted:continue
            for v in obj.get('hasVariant',[]):
                url=(v.get('offers') or {}).get('url','');parsed=urllib.parse.urlparse(url)
                if parsed.scheme=='https' and parsed.hostname=='www.refurbed.ie' and parsed.path.startswith('/p/'):
                    result.setdefault(norm(v.get('color','')),{'sku':str(v.get('sku','')),'url':url})
    return result

def refurbed_photos(page,variant):
    if not re.search(r'data-instance-id="'+re.escape(variant['sku'])+r'"',page):return []
    decoded=html.unescape(page)
    match=re.search(r'ImageGallery\(\{.*?thumbnailsURLs:\s*\[(.*?)\]',decoded,re.S)
    if not match:return []
    urls=re.findall(r"['\"](https://files\.refurbed\.com/ii/[^'\"]+)['\"]",match[1])
    return [{'sourceImage':u.split('?')[0]+'?t=resize&w=1200&h=1200','sourcePage':variant['url'],'credit':'Refurbed','label':'Perspectiva '+str(i+1)} for i,u in enumerate(dict.fromkeys(urls))]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--page-cache',type=pathlib.Path);args=parser.parse_args()
    limits={'swappie':False}
    path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text());products=manifest['products']
    discovery=module('d','discover-catalog-images.py');gallery=module('g','fetch-catalog-galleries.py');download=module('f','fetch-catalog-images.py').download
    groups={}
    for key,item in products.items():
        if count(item)<4 and sum(g.get('credit') in ['Swappie','Refurbed'] for g in item.get('gallery',[]))<2:groups.setdefault(item['model'],[]).append((key,item))
    def gather(pair):
        model,entries=pair;results=[]
        try:
            if model.startswith('iPhone '):
                source='https://swappie.com/us/iphone/'+model.lower().replace(' ','-')+'/'
                cached=args.page_cache/(model.lower().replace(' ','-')+'.html') if args.page_cache else None
                if cached and cached.exists():page=cached.read_text()
                elif limits['swappie']:return []
                else:
                    page=discovery.read(source)
                    if cached:cached.parent.mkdir(parents=True,exist_ok=True);cached.write_text(page)
                records=swappie_records(page,model,source)
                for key,item in entries:
                    for art in records.get(norm(item.get('officialColor','')),[]):results.append((key,art))
            else:
                slugs={'Samsung S21 Ultra':'samsung-galaxy-s21-ultra-5g','Samsung S22 Ultra':'samsung-galaxy-s22-ultra-5g','Samsung Z Flip 4':'samsung-galaxy-z-flip-4','Samsung Z Fold 5':'samsung-galaxy-z-fold-5'}
                if model not in slugs:return []
                source='https://www.refurbed.ie/p/'+slugs[model]+'/'
                variants=refurbed_variants(discovery.read(source),model)
                colors={'phantomblack':'black','phantomsilver':'silver','phantomwhite':'white','green':'green','burgundy':'burgundy','icyblue':'blue'}
                for key,item in entries:
                    finish=norm(item.get('officialColor',''));variant=variants.get(finish) or variants.get(colors.get(finish,''))
                    if variant:
                        for art in refurbed_photos(discovery.read(variant['url']),variant):results.append((key,art))
        except Exception as error:
            if model.startswith('iPhone ') and getattr(error,'code',None)==429:limits['swappie']=True
            print('Gallery source pending:',model,type(error).__name__,getattr(error,'code',''))
        return results
    tasks=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        for records in pool.map(gather,groups.items()):tasks.extend(records)
    # Source URLs are stable identifiers, independent of gallery order.
    import hashlib
    tasks=[(key,art) for key,art in tasks if art['sourceImage'] not in products[key].get('galleryRejectedSources',[]) and not any(g.get('sourceImage')==art['sourceImage'] for g in products[key].get('gallery',[]))]
    def save(task):
        key,art=task;item=products[key];suffix=hashlib.sha256(art['sourceImage'].encode()).hexdigest()[:10]
        try:
            _,saved=download((key+' view '+suffix,{**art,'model':item['model'],'color':item['color']}))
            return key,saved
        except Exception:return None
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=[r for r in pool.map(save,tasks) if r]
    added=0
    for key,art in results:
        parent=products[key];reference=next((g for g in parent.get('gallery',[]) if g.get('label')=='Vista general en alta resolución'),parent)
        prior=[reference]+[g for g in parent.get('gallery',[]) if g.get('label')!='Vista general en alta resolución']
        if any(gallery.repeated_photo(old,art) for old in prior):
            parent.setdefault('galleryRejectedSources',[]).append(art['sourceImage']);(ROOT/'catalogo'/art['path']).unlink(missing_ok=True)
        else:parent.setdefault('gallery',[]).append(art);added+=1
    if results:path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Distinct product views added:',added)
    print('Model/color galleries with at least 3 photos:',sum(count(p)>=3 for p in products.values()),'of',len(products))
    for key,item in products.items():
        if count(item)<3:print('Still needs verified perspectives:',key)

if __name__=='__main__':main()
