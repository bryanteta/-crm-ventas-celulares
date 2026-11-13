#!/usr/bin/env python3
"""Collect reviewed Apple camera-detail assets, never paired product artboards."""
import concurrent.futures
import importlib.util
import json
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parent.parent
# AV2 is a separately published, single-device camera detail in these reviewed
# original-store families. Refurbished AV assets use different semantics (groups
# and boxes), so those assets are deliberately excluded.
STEMS={
    'iPhone 11':'iphone11-{finish}-select-2019',
    'iPhone 12':'iphone-12-{finish}-select-2020',
    'iPhone 13 Mini':'iphone-13-mini-{finish}-select-2021',
    'iPhone 13':'iphone-13-{finish}-select-2021',
    'iPhone 13 Pro':'iphone-13-pro-{finish}-select',
    'iPhone 13 Pro Max':'iphone-13-pro-max-{finish}-select',
    'iPhone 14':'iphone-14-{finish}-select-202209',
    'iPhone 14 Plus':'iphone-14-plus-{finish}-select-202209',
    'iPhone 14 Pro':'iphone-14-pro-{finish}-select',
    'iPhone 14 Pro Max':'iphone-14-pro-max-{finish}-select',
    'iPhone 15':'iphone-15-{finish}-select-202309',
    'iPhone 15 Plus':'iphone-15-plus-{finish}-select-202309',
    'iPhone 15 Pro':'iphone-15-pro-{finish}-select',
    'iPhone 15 Pro Max':'iphone-15-pro-max-{finish}-select',
    'iPhone 16':'iphone-16-{finish}-select-202409',
    'iPhone 16 Plus':'iphone-16-plus-{finish}-select-202409',
    'iPhone 16 Pro':'iphone-16-pro-{finish}-select',
    'iPhone 16 Pro Max':'iphone-16-pro-max-{finish}-select',
    'iPhone 17 Pro':'iphone-17-pro-finish-select-{finish}-202509',
    'iPhone 17 Pro Max':'iphone-17-pro-max-finish-select-{finish}-202509',
    'iPhone 18 Pro':'iphone-18-pro-finish-select-{finish}-202609',
    'iPhone 18 Pro Max':'iphone-18-pro-max-finish-select-{finish}-202609',
}

def candidate(item):
    template=STEMS.get(item.get('model'))
    finish=item.get('officialColor','')
    if not template or not re.fullmatch('[a-z]+',finish):return None
    # These are the asset names Apple uses for the same official finishes.
    if item['model'] in ['iPhone 13 Pro','iPhone 13 Pro Max']:
        finish={'sierrablue':'blue','alpinegreen':'green'}.get(finish,finish)
    if item['model']=='iPhone 13' and finish=='green':template='iphone-13-{finish}-select'
    if item['model']=='iPhone 13' and finish=='red':finish='product-red'
    return {'model':item['model'],'color':item['color'],'officialColor':item['officialColor'],
        'sourceImage':'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/'+template.format(finish=finish)+'_AV2?wid=1200&hei=1200&fmt=jpeg&qlt=90',
        'sourcePage':'https://www.apple.com/iphone/compare/',
        'credit':'Apple','label':'Detalle de cámaras','singleDevice':True}

def reviewed_press_views(item):
    # Exact public press photos reviewed as a single Midnight Green Pro Max.
    # Other colors/models cannot reuse these scenes.
    if (item.get('model'),item.get('officialColor'))!=('iPhone 11 Pro Max','midnightgreen'):return []
    return [{
        'model':item['model'],'color':item['color'],'officialColor':item['officialColor'],
        'sourceImage':'https://fdn2.gsmarena.com/vv/pics/apple/apple-iphone-11-pro-max-'+str(number)+'.jpg',
        'sourcePage':'https://www.gsmarena.com/apple_iphone_11_pro_max-pictures-9846.php',
        'credit':'Apple · GSMArena','label':label,'singleDevice':True
    } for number,label in [(5,'Vista posterior lateral'),(6,'Detalle de cámaras · ángulo lateral')]]

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def frame_camera_detail(art):
    # Fit the actual manufacturer photo, removing only blank canvas in CSS.
    # The downloaded image bytes are preserved; this is not a new perspective.
    from PIL import Image,ImageChops
    with Image.open(ROOT/'catalogo'/art['path']) as source:
        image=source.convert('RGB')
        mask=ImageChops.difference(image,Image.new('RGB',image.size,'white')).convert('L').point(lambda value:255 if value>25 else 0)
        bounds=mask.getbbox()
        if not bounds:return
        x,y,right,bottom=bounds;pad=round(max(right-x,bottom-y)*.025)
        x=max(0,x-pad);y=max(0,y-pad);right=min(image.width,right+pad);bottom=min(image.height,bottom+pad)
        art['framing']={'x':x,'y':y,'width':right-x,'height':bottom-y}

def main():
    path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text())
    download=load('images','fetch-catalog-images.py').download
    same=load('galleries','fetch-catalog-galleries.py').repeated_photo
    tasks=[]
    for key,item in manifest['products'].items():
        detail=candidate(item)
        for art in ([detail] if detail else [])+reviewed_press_views(item):
            if art['sourceImage'] not in item.get('galleryRejectedSources',[]) and not any(g.get('sourceImage')==art['sourceImage'] for g in item.get('gallery',[])):
                tasks.append((key,art))
    def save(task):
        key,art=task
        try:return key,download((key+' apple '+('camera-detail' if art['label']=='Detalle de cámaras' else 'press-'+art['sourceImage'].rsplit('-',1)[-1].split('.')[0]),art))[1]
        except Exception as e:
            print('Apple detail pending:',key,type(e).__name__);return None
    added=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(save,tasks):
            if not result:continue
            key,art=result;parent=manifest['products'][key]
            if any(same(g,art) for g in parent.get('gallery',[]) if g.get('singleDevice')):
                parent.setdefault('galleryRejectedSources',[]).append(art['sourceImage'])
                (ROOT/'catalogo'/art['path']).unlink(missing_ok=True)
            else:parent.setdefault('gallery',[]).append(art);added+=1
    for parent in manifest['products'].values():
        for art in parent.get('gallery',[]):
            if art.get('credit')=='Apple' and art.get('label')=='Detalle de cámaras':frame_camera_detail(art)
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Distinct Apple individual views added:',added)
    for key,item in manifest['products'].items():
        if item['model'].startswith('iPhone '):
            views=sum(g.get('singleDevice') is True for g in item.get('gallery',[]))
            if views<3:print('More verified individual views needed:',key,views)

if __name__=='__main__':main()
