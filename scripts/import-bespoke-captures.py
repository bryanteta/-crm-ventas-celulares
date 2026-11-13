#!/usr/bin/env python3
"""Register reviewed screenshots of the original manufacturer model without editing pixels."""
import argparse,hashlib,importlib.util,json,pathlib,re
from PIL import Image,ImageChops
ROOT=pathlib.Path(__file__).resolve().parent.parent
p=argparse.ArgumentParser();p.add_argument('captures',type=pathlib.Path);args=p.parse_args()
sources=json.loads((ROOT/'scripts/bespoke-render-sources.json').read_text())
spec=importlib.util.spec_from_file_location('g',ROOT/'scripts/fetch-catalog-galleries.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
path=ROOT/'catalogo/product-images.json';manifest=json.loads(path.read_text());count=0
for art in json.loads(args.captures.read_text()):
    render=art['sourceRender'];expected={'Blanco':'white','Amarillo':'yellow'}
    if art['model']!='Samsung Z Flip 4' or art['color'] not in expected or render['frontGlass']!=expected[art['color']] or render['backGlass']!=expected[art['color']] or render['frame']!='silver' or render['model']!=sources['files']['assets/models/b4-studio-v2-cp.glb'] or render['renderer']!=sources['files']['viewer/FlipViewer.js']:raise ValueError('Manufacturer model/finish proof does not match the selected phone')
    if art.get('sourceType')!='manufacturer-3d-view' or art.get('sourcePage')!=sources['sourcePage'] or not re.fullmatch(r'assets/products/samsung-z-flip-4-(?:blanco|amarillo)-studio-(?:half-open|open-front|closed-front|closed-back)\.png',art['path']):raise ValueError('Unexpected manufacturer capture')
    file=ROOT/'catalogo'/art['path']
    with Image.open(file) as source:
        source.verify()
    with Image.open(file) as source:
        width,height=source.size;image=source.convert('RGB');mask=ImageChops.difference(image,Image.new('RGB',source.size,'white')).convert('L').point(lambda value:255 if value>20 else 0);box=mask.getbbox()
    if not box or min(box[2]-box[0],box[3]-box[1])<150:raise ValueError('Manufacturer capture did not render a full device')
    pad=18;x=max(0,box[0]-pad);y=max(0,box[1]-pad);right=min(width,box[2]+pad);bottom=min(height,box[3]+pad)
    art={**art,'width':width,'height':height,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'framing':{'x':x,'y':y,'width':right-x,'height':bottom-y}}
    parent=manifest['products'][art['model']+'|'+art['color']];reference=parent
    previous=[reference]+[old for old in parent.get('gallery',[]) if old['path']!=art['path']]
    if any(g.repeated_photo(old,art) for old in previous):
        parent['gallery']=[old for old in parent.get('gallery',[]) if old['path']!=art['path']];file.unlink(missing_ok=True);continue
    parent['gallery']=[old for old in parent.get('gallery',[]) if old['path']!=art['path']]+[art];count+=1
path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Verified original manufacturer 3D views registered:',count)
