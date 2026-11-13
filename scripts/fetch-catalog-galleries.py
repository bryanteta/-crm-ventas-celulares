#!/usr/bin/env python3
"""Add exact-color official perspectives and higher resolution Apple comparisons."""
import concurrent.futures
import importlib.util
import json
import pathlib
import re
import hashlib

ROOT=pathlib.Path(__file__).resolve().parent.parent

def module(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod

def apple_store_candidates(page, source_page):
    result={}
    urls=re.findall(r'https://store\.storeimages\.cdn-apple\.com/[^"\s<>?]+/refurb-iphone[^"\s<>?]+',page)
    for url in urls:
        asset=url.rsplit('/',1)[-1]
        match=re.fullmatch(r'refurb-iphone-?(\d+(?:-pro-max|-pro|-plus|-mini)?)-([a-z]+)-(\d{4,6})',asset)
        if not match:continue  # Excludes AV color groups, boxes, og and accessories.
        model='iPhone '+match[1].replace('-',' ').title()
        result[model,match[2]]={'sourceImage':url+'?wid=1200&hei=1200&fmt=jpeg&qlt=90','sourcePage':source_page}
    return result

def legacy_apple_candidate(item):
    model=item['model'];finish=item.get('officialColor','').lower()
    if not re.fullmatch('[a-z]+',finish):return None
    dates={'11':'2019','12':'2020','13':'2023','14':'202404'}
    number=model.removeprefix('iPhone ').split()[0]
    if number not in dates or not model.startswith('iPhone '):return None
    # Original Apple product asset names; a missing asset stays pending.
    slug=model.lower().replace(' ','-')
    if number=='11':
        if model!='iPhone 11':return None
        slug='iphone11'
    return {'sourceImage':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-'+slug+'-'+finish+'-'+dates[number]+'?wid=1200&hei=1200&fmt=jpeg&qlt=90','sourcePage':'https://www.apple.com/shop/refurbished/iphone'}

def repeated_photo(first, second):
    from PIL import Image, ImageChops, ImageStat
    def normalized(art):
        with Image.open(ROOT/'catalogo'/art['path']) as source:
            image=source.convert('RGBA');background=Image.new('RGBA',image.size,'white');background.alpha_composite(image);image=background.convert('RGB')
        mask=ImageChops.difference(image,Image.new('RGB',image.size,'white')).convert('L').point(lambda value:255 if value>25 else 0)
        bounds=mask.getbbox()
        if bounds:image=image.crop(bounds)
        return image.resize((96,96),Image.Resampling.LANCZOS)
    difference=ImageStat.Stat(ImageChops.difference(normalized(first),normalized(second)))
    return sum(difference.mean)/3<10

def main():
    path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text())
    discovery=module('discovery','discover-catalog-images.py');download=module('download','fetch-catalog-images.py').download
    samsung={}
    normalize=lambda value: re.sub('[^a-z0-9]','',value.lower())
    def read_samsung(region):
        try:
            url='https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=01010000&siteCode='+region+'&start=1&num=100&sort=onlineavail&onlyFilterInfoYN=N'
            return discovery.samsung_candidates(json.loads(discovery.read(url)),include_unknown=True)
        except Exception:
            print('Samsung '+region+' unavailable; existing galleries preserved.');return {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for source in pool.map(read_samsung,['uk','us','latin','es']):
            for (model,_),candidate in source.items():
                key=(model,normalize(candidate['officialColor']))
                if len(candidate.get('gallerySources',[]))>len(samsung.get(key,{}).get('gallerySources',[])):
                    samsung[key]=candidate
    apple={}
    for page in ['https://www.apple.com/shop/refurbished/iphone','https://www.apple.com/uk/shop/refurbished/iphone']:
        try:apple.update(apple_store_candidates(discovery.read(page),page))
        except Exception:print('Apple store unavailable; existing photos preserved.')
    tasks=[]
    for key,item in manifest['products'].items():
        if item['model'].startswith('Samsung '):
            candidate=samsung.get((item['model'],normalize(item.get('officialColor',''))))
            if not candidate:continue
            # A different regional SKU is allowed only with the same official
            # finish; a local color nickname alone cannot substitute a finish.
            if normalize(item.get('officialColor',''))!=normalize(candidate['officialColor']):continue
            for i,view in enumerate(candidate.get('gallerySources',[])):
                if view['sourceImage'] in item.get('galleryRejectedSources',[]) or any(g.get('sourceImage')==view['sourceImage'] for g in item.get('gallery',[])):continue
                tasks.append((key,i,{**candidate,**view,'model':item['model'],'color':item['color']}))
        elif item['model'].startswith('iPhone '):
            if any(p.get('label')=='Vista posterior' for p in item.get('gallery',[])):continue
            candidate=apple.get((item['model'],item.get('officialColor','').lower())) or legacy_apple_candidate(item)
            if candidate and candidate['sourceImage'] not in item.get('galleryRejectedSources',[]):tasks.append((key,'rear',{**candidate,'model':item['model'],'color':item['color'],'officialColor':item.get('officialColor',''),'credit':'Apple','label':'Vista posterior'}))
    def save(task):
        key,index,item=task
        # Keep gallery assets separate from the card photo. Preserve original bytes.
        try:
            _,saved=download((key+' gallery '+('rear' if index=='rear' else hashlib.sha256(item['sourceImage'].encode()).hexdigest()[:10]),item))
            saved.pop('gallerySources',None);saved.pop('gallery',None)
            parent=manifest['products'][key]
            reference=next((p for p in parent.get('gallery',[]) if p.get('label')=='Vista general en alta resolución'),parent)
            if any(repeated_photo(old,saved) for old in [reference]+[a for a in parent.get('gallery',[]) if a.get('label')!='Vista general en alta resolución']):
                (ROOT/'catalogo'/saved['path']).unlink(missing_ok=True);return key,None,item['sourceImage']
            return key,saved,None
        except Exception:
            return None
    saved=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        saved=[result for result in pool.map(save,tasks) if result]
    count=0
    for key,item,rejected in saved:
        parent=manifest['products'][key]
        if rejected:
            if rejected not in parent.setdefault('galleryRejectedSources',[]):parent['galleryRejectedSources'].append(rejected)
        elif item['sha256']!=parent.get('sha256') and not any(p.get('sha256')==item['sha256'] for p in parent.get('gallery',[])):
            parent.setdefault('gallery',[]).append(item);count+=1
    if saved:path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Official gallery photos added:',count)

if __name__=='__main__':main()
