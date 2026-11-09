#!/usr/bin/env python3
"""Read-only supplier snapshot for a private APK; never exports the API key."""
import argparse, datetime, json, os, pathlib, subprocess, urllib.request
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='android/provider-bootstrap.json')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
sources = {
    'samuel': ('https://script.google.com/macros/s/AKfycbweF6GVeLUBF6zIiUuPS6CsVSzKyabDV1kHrXgehpmQKnXVa40yqGPw6ltA3fjebQCLxw/exec?fn=getCatalogo&a=%5B%5D', {}),
    'split': ('https://split-crm.splitelsalvador.workers.dev/api/v1/inventario', {'X-API-Key': os.environ['SPLIT_INVENTORY_TOKEN']}),
}
raw = {}
for name, (url, headers) in sources.items():
    request = urllib.request.Request(url, headers={'User-Agent': 'Lunivo/1.5.5', 'Accept': 'application/json', **headers})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(4 * 1024 * 1024 + 1)
        if len(body) > 4 * 1024 * 1024:
            raise ValueError('Supplier response exceeds size limit')
        raw[name] = body.decode('utf-8-sig')
program = "const fs=require('node:fs'),core=require('./feeds-core.js'),raw=JSON.parse(fs.readFileSync(0,'utf8'));const providers={};for(const p of ['samuel','split'])providers[p]=core.validate(p,(p==='samuel'?core.samuelApi:core.split)(raw[p]));process.stdout.write(JSON.stringify({version:1,checkedAt:new Date().toISOString(),providers}));"
result = subprocess.run(['node', '-e', program], input=json.dumps(raw), text=True, cwd=root, capture_output=True, check=True)
snapshot = json.loads(result.stdout)
output = root / args.output
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
for name, provider in snapshot['providers'].items():
    print(name, provider['total'], 'equipos', len(provider['rows']), 'variantes')
print('Private snapshot saved:', args.output)
