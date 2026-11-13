#!/usr/bin/env python3
"""Add exact-color official perspectives and higher resolution Apple comparisons."""
import concurrent.futures
import importlib.util
import json
import pathlib

ROOT=pathlib.Path(__file__).resolve().parent.parent

def module(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod

def main():
    path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text())
    discovery=module('discovery','discover-catalog-images.py');download=module('download','fetch-catalog-images.py').download
    samsung={}
    try:
        url='https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=01010000&siteCode=uk&start=1&num=100&sort=onlineavail&onlyFilterInfoYN=N'
        samsung=discovery.samsung_candidates(json.loads(discovery.read(url)))
    except Exception:
        print('Samsung unavailable; existing galleries preserved.')
    tasks=[]
    for key,item in manifest['products'].items():
        if item.get('gallery'):continue
        if item['model'].startswith('Samsung '):
            candidate=samsung.get((item['model'],item['color']))
            if not candidate:continue
            # A different regional SKU is allowed only with the same official
            # finish; a local color nickname alone cannot substitute a finish.
            if item.get('officialColor','').lower()!=candidate['officialColor'].lower():continue
            for i,view in enumerate(candidate.get('gallerySources',[])):
                tasks.append((key,i,{**candidate,**view,'model':item['model'],'color':item['color']}))
        elif '/compare_iphone' in item.get('sourceImage','') and item.get('width',0)<600:
            tasks.append((key,0,{**item,'sourceImage':item['sourceImage'].replace('_large.jpg','_large_2x.jpg'),'label':'Vista general en alta resolución'}))
    def save(task):
        key,index,item=task
        # Keep gallery assets separate from the card photo. Preserve original bytes.
        try:
            _,saved=download((key+' gallery '+str(index+1),item))
            saved.pop('gallerySources',None);saved.pop('gallery',None)
            return key,saved
        except Exception:
            return None
    saved=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        saved=[result for result in pool.map(save,tasks) if result]
    for key,item in saved:manifest['products'][key].setdefault('gallery',[]).append(item)
    if saved:path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Official gallery photos added:',len(saved))

if __name__=='__main__':main()
