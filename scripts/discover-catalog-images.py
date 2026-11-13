#!/usr/bin/env python3
"""Resolve new catalog colors against official product metadata; never guess a photo."""
import argparse
import concurrent.futures
import importlib.util
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIVE = 'https://lunivo-inventory.bra0307h.workers.dev/inventory.json'

def read(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise ValueError('Official response too large')
    return data.decode('utf-8')

def apple_candidates(css, base):
    result = {}
    # Require the exact model/color selector, not a substring (13 vs 13 Pro).
    for selector, body in re.findall(r'([^{}]+)\{([^{}]+)\}', css):
        url = re.search(r'background-image\s*:\s*url\([\'\"]?([^\)\'\"]+)', body)
        if not url or '_large_2x.' not in url[1]:
            continue
        for model, finish in re.findall(r'\.image-compare-iphone-(\d+(?:-pro-max|-pro|-plus|-mini|-air)?)-([a-z]+)(?=[\s,:.{]|$)', selector):
            name = 'iPhone ' + model.replace('-', ' ').title()
            result[name, finish] = {'sourceImage': urllib.parse.urljoin(base, url[1]), 'sourcePage': 'https://www.apple.com/iphone/compare/', 'credit': 'Apple', 'officialColor': finish}
    return result

APPLE_COLORS = {'Blanco': ('white', 'starlight'), 'Negro': ('black', 'midnight', 'graphite', 'spaceblack', 'blacktitanium'), 'Morado': ('purple',), 'Lila': ('purple',), 'Rosado': ('pink',), 'Rojo': ('red',), 'Verde': ('green',), 'Azul': ('blue', 'deepblue'), 'Celeste': ('blue', 'skyblue'), 'Amarillo': ('yellow',), 'Plata': ('silver',), 'Dorado': ('gold',), 'Anaranjado': ('cosmicorange', 'orange'), 'Titanio natural': ('naturaltitanium',), 'Titanio desierto': ('deserttitanium',)}
SAMSUNG_COLORS = {'black': 'Negro', 'phantom black': 'Negro', 'titanium black': 'Negro', 'white': 'Blanco', 'phantom white': 'Blanco', 'titanium white silver': 'Blanco', 'gray': 'Gris', 'grey': 'Gris', 'titanium gray': 'Gris', 'titanium grey': 'Gris', 'silver': 'Plata', 'phantom silver': 'Plata', 'blue': 'Azul', 'navy': 'Azul', 'sky blue': 'Celeste', 'icyblue': 'Celeste', 'pink': 'Rosado', 'green': 'Verde', 'mint': 'Verde', 'yellow': 'Amarillo', 'cream': 'Crema', 'lavender': 'Lila'}

def samsung_candidates(data, include_unknown=False):
    result = {}
    rows = data['response']['resultData']['productList']
    for product in rows:
        name = re.sub(r'\s*\([^)]*\)', '', product['fmyMarketingName']).strip()
        name = re.sub(r'\s+5G$', '', name)
        name = re.sub(r'\s+Certified Re-Newed$', '', name)
        name = re.sub(r'(\d)\+', r'\1 Plus', name)
        # Keep unrelated hardware editions separate; renewed phones share the same exterior model.
        if not re.fullmatch(r'Galaxy (?:[SAM]\d+|Note\s?\d+|Z (?:Flip|Fold)\d+)(?: (?:Ultra|FE|Plus|\+))?', name):
            continue
        name = 'Samsung ' + name.removeprefix('Galaxy ')
        name = re.sub(r'(Flip|Fold)(\d)', r'\1 \2', name)
        for item in product.get('modelList', []):
            chips = [c for c in item.get('fmyChipList', []) if c.get('fmyChipType') == 'COLOR']
            if len(chips) != 1:
                continue
            page=item.get('originPdpUrl') or item.get('pdpUrl')
            if not isinstance(page,str) or not page.startswith('/'):continue
            finish = chips[0]['fmyChipName']
            color = SAMSUNG_COLORS.get(finish.lower()) or (finish if include_unknown else None)
            photo = item.get('largeUrl', '')
            if not color or not photo.startswith('//images.samsung.com/'):
                continue
            gallery = []
            for url, alt in zip(item.get('galleryImage') or [], item.get('galleryImageAlt') or []):
                if not url.startswith('//images.samsung.com/') or item['modelCode'].lower() not in url.lower() or finish.lower() not in alt.lower():
                    continue
                labels = [('closedback','Cerrado · reverso'), ('openfront','Abierto · frente'), ('openback','Abierto · reverso'), ('backl30','Parte posterior'), ('backr30','Vista posterior lateral'), ('frontl30','Vista frontal lateral'), ('frontr30','Vista frontal lateral opuesta'), ('front2','Frente'), ('front','Frente'), ('back','Reverso')]
                normalized_alt=alt.lower().replace('devicepen','device')
                label = next((label for marker,label in labels if re.search(r'\b(?:device)?'+marker+r'\b',normalized_alt)),None)
                if label and not any(g['label'] == label for g in gallery):
                    gallery.append({'sourceImage': 'https:' + url + '?$900_900_PNG$', 'label': label})
            result.setdefault((name, color), {'sourceImage': 'https:' + photo + '?$624_624_PNG$', 'sourcePage': 'https://www.samsung.com' + page, 'sourceSku': item['modelCode'], 'credit': 'Samsung', 'officialColor': finish, 'gallerySources': gallery[:4]})
    return result

def resolve(product, apple, samsung, reviewed):
    model, color = product['model'], product['color']
    if color == 'Color por confirmar' or '/' in color:
        return None
    if model.startswith('iPhone '):
        finishes = APPLE_COLORS.get(color, ())
        # Keep a reviewed model-specific interpretation when one already exists.
        known = reviewed.get(model + '|' + color, {}).get('officialColor')
        if known:
            finishes = (known,)
        matches = [apple[model, finish] for finish in finishes if (model, finish) in apple]
        if len(matches) != 1:
            return None
        return {**matches[0], 'model': model, 'color': color}
    candidate = samsung.get((model, color))
    return {**candidate, 'model': model, 'color': color} if candidate else None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', type=pathlib.Path)
    args = parser.parse_args()
    catalog = json.loads(args.inventory.read_text() if args.inventory else read(LIVE))
    if catalog.get('schemaVersion') != 1 or catalog.get('brand') != 'Lunivo':
        raise ValueError('Invalid public catalog')
    path = ROOT / 'catalogo/product-images.json'
    manifest = json.loads(path.read_text())
    missing = {p['model']+'|'+p['color']: p for p in catalog['products'] if p['model']+'|'+p['color'] not in manifest['products']}
    if not missing:
        print('All known colors already have photos.')
        return
    apple, samsung = {}, {}
    try:
        page = read('https://www.apple.com/iphone/compare/')
        stylesheet = re.search(r'href="(/v/iphone/compare/[^\"]+/built/styles/overview.built.css)"', page)
        if stylesheet:
            url = 'https://www.apple.com' + stylesheet[1]
            apple = apple_candidates(read(url), url)
    except Exception:
        print('Apple unavailable; preserving reviewed photos.')
    try:
        url = 'https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=01010000&siteCode=uk&start=1&num=100&sort=onlineavail&onlyFilterInfoYN=N'
        samsung = samsung_candidates(json.loads(read(url)))
    except Exception:
        print('Samsung unavailable; preserving reviewed photos.')
    spec = importlib.util.spec_from_file_location('image_download', ROOT / 'scripts/fetch-catalog-images.py')
    downloader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(downloader)
    candidates = [(key, candidate) for key, product in missing.items() if (candidate := resolve(product, apple, samsung, manifest['products']))]
    def save(entry):
        try:
            return downloader.download(entry)
        except Exception:
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        saved = [entry for entry in pool.map(save, candidates) if entry]
    if saved or missing:
        manifest['products'].update(dict(saved))
        for key in missing:
            if key not in manifest['products']:
                manifest.setdefault('unavailable', {}).setdefault(key, {'model': missing[key]['model'], 'color': missing[key]['color'], 'reason': 'Sin coincidencia oficial verificada; consulta automática pendiente.'})
        for key, _ in saved:
            manifest.get('unavailable', {}).pop(key, None)
        manifest['products'] = dict(sorted(manifest['products'].items()))
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Official photos added: {len(saved)}. Pending exact model/color: {len(missing)-len(saved)}.')

if __name__ == '__main__':
    main()
