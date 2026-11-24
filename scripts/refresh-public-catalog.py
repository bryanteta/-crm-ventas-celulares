#!/usr/bin/env python3
"""Refresh the public catalog without storing private source data in the checkout."""
import pathlib
import subprocess
import tempfile
import json
import urllib.request
import urllib.parse

root = pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='lunivo-catalog-') as directory:
    private_snapshot = str(pathlib.Path(directory) / 'snapshot.json')
    subprocess.run(['python3', str(root / 'scripts/fetch-provider-snapshot.py'), '--output', private_snapshot], cwd=root, check=True)
    subprocess.run(['node', str(root / 'scripts/build-public-catalog.cjs'), private_snapshot, str(root / 'catalogo/inventory.json')], cwd=root, check=True)

# Public overrides contain no credentials. Keep the last validated snapshot if
# the optional service is temporarily unreachable; never replace it with empty.
try:
    config = json.loads((root / 'catalogo/inventory-source.json').read_text())
    endpoint = urllib.parse.urlparse(config['endpoint'])
    if endpoint.scheme != 'https' or not endpoint.hostname.endswith('.workers.dev') or endpoint.path != '/inventory.json':
        raise ValueError('Invalid catalog service')
    url = urllib.parse.urlunparse(endpoint._replace(path='/customizations.json', query='', fragment=''))
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Lunivo-Catalog-Snapshot'}), timeout=15) as response:
        body = response.read(1024 * 1024 + 1)
    if len(body) > 1024 * 1024:
        raise ValueError('Oversized public configuration')
    program = r"const fs=require('node:fs'),core=require('./catalogo/customization-core.js'),file='catalogo/customizations.json',next=core.state(JSON.parse(fs.readFileSync(0,'utf8'))),old=fs.existsSync(file)?core.state(JSON.parse(fs.readFileSync(file,'utf8'))):core.empty();if(next.revision>=old.revision){fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2)+'\n');fs.renameSync(file+'.tmp',file);console.log('Ediciones públicas sincronizadas.');}"
    subprocess.run(['node','-e',program], input=body, cwd=root, capture_output=True, check=True)
except Exception:
    print('Se conserva la última copia válida de las ediciones públicas.')
