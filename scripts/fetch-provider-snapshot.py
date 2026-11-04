#!/usr/bin/env python3
"""Read-only supplier snapshot for a private APK; never exports the API key."""
import argparse, datetime, json, os, pathlib, subprocess, urllib.request
parser = argparse.ArgumentParser()
parser.add_argument('--output', default='android/provider-bootstrap.json')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
sources = {
    'samuel': ('https://docs.google.com/spreadsheets/d/1DRiuHV7tNbjCL0VH2ml_RuWSWwtJCYXoSJ7VsVK2ccg/gviz/tq?tqx=out:csv', {}),
    'split': ('https://split-crm.splitelsalvador.workers.dev/api/v1/inventario', {'X-API-Key': os.environ['SPLIT_INVENTORY_TOKEN']}),
}
raw = {}
for name, (url, headers) in sources.items():
    request = urllib.request.Request(url, headers={'User-Agent': 'Lunivo/1.5.5', 'Accept': 'application/json,text/csv', **headers})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(4 * 1024 * 1024 + 1)
        if len(body) > 4 * 1024 * 1024:
            raise ValueError('Supplier response exceeds size limit')
        raw[name] = body.decode('utf-8-sig')
program = "const fs=require('node:fs'),core=require('./feeds-core.js'),raw=JSON.parse(fs.readFileSync(0,'utf8'));const providers={};for(const p of ['samuel','split'])providers[p]=core.validate(p,core[p](raw[p]));process.stdout.write(JSON.stringify({version:1,checkedAt:new Date().toISOString(),providers}));"
result = subprocess.run(['node', '-e', program], input=json.dumps(raw), text=True, cwd=root, capture_output=True, check=True)
snapshot = json.loads(result.stdout)
output = root / args.output
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
for name, provider in snapshot['providers'].items():
    print(name, provider['total'], 'equipos', len(provider['rows']), 'variantes')
print('Private snapshot saved:', args.output)
