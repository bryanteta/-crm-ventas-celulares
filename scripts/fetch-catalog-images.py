#!/usr/bin/env python3
"""Download the reviewed official model images, preserving original image bytes."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import pathlib
import urllib.parse
import urllib.request
import re
import unicodedata
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
manifest_path = root / 'catalogo/product-images.json'
manifest = json.loads(manifest_path.read_text())
output = root / 'catalogo/assets/products'
output.mkdir(parents=True, exist_ok=True)

def official(url):
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == 'https' and any(parsed.hostname == host or (parsed.hostname or '').endswith('.' + host) for host in ('apple.com', 'samsung.com'))

def download(entry):
    model, item = entry
    if not official(item['sourceImage']) or not official(item['sourcePage']):
        raise ValueError('Image source must be an official Apple or Samsung URL')
    request = urllib.request.Request(item['sourceImage'], headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*'})
    with urllib.request.urlopen(request, timeout=35) as response:
        if not official(response.url):
            raise ValueError('Unexpected image redirect')
        data = response.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise ValueError('Image too large')
    with Image.open(io.BytesIO(data)) as image:
        image.verify()
        width, height = image.size
        extension = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}.get(image.format)
    if not extension or min(width, height) < 200:
        raise ValueError('Image is not an adequate product photo')
    slug = re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',model).encode('ascii','ignore').decode().lower()).strip('-')
    filename = slug + '.' + extension
    target = output / filename
    temporary = output / (filename + '.tmp')
    temporary.write_bytes(data)
    temporary.replace(target)
    return model, {**item, 'path': 'assets/products/' + filename, 'sha256': hashlib.sha256(data).hexdigest(), 'width': width, 'height': height}

parser=argparse.ArgumentParser()
parser.add_argument('--model',action='append',help='Download only the specified model (repeatable)')
args=parser.parse_args()
entries=[(model,item) for model,item in manifest['products'].items() if not args.model or item['model'] in args.model]
if args.model and set(args.model)-{item['model'] for item in manifest['products'].values()}:
    raise ValueError('Unknown model')
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(download, entries))
manifest['products'].update(dict(results))
manifest['products'] = dict(sorted(manifest['products'].items()))
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Official model images saved:', len(results))
