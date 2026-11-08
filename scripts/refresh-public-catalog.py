#!/usr/bin/env python3
"""Refresh the public catalog without storing private source data in the checkout."""
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='lunivo-catalog-') as directory:
    private_snapshot = str(pathlib.Path(directory) / 'snapshot.json')
    subprocess.run(['python3', str(root / 'scripts/fetch-provider-snapshot.py'), '--output', private_snapshot], cwd=root, check=True)
    subprocess.run(['node', str(root / 'scripts/build-public-catalog.cjs'), private_snapshot, str(root / 'catalogo/inventory.json')], cwd=root, check=True)
