#!/usr/bin/env python3
"""Fetch and verify the original Samsung viewer, geometry and materials."""
import argparse,hashlib,json,pathlib,urllib.request
root=pathlib.Path(__file__).resolve().parent.parent
p=argparse.ArgumentParser();p.add_argument('directory',type=pathlib.Path);args=p.parse_args()
sources=json.loads((root/'scripts/bespoke-render-sources.json').read_text())
for name,asset in sources['files'].items():
    target=args.directory/name
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==asset['sha256']:continue
    request=urllib.request.Request(asset['url'],headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request,timeout=40) as response:data=response.read(32*1024*1024)
    if hashlib.sha256(data).hexdigest()!=asset['sha256']:raise ValueError('Manufacturer asset changed; review before capturing another view.')
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
print('Original Samsung renderer and model verified.')
