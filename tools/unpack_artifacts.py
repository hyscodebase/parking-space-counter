#!/usr/bin/env python3
"""Verify packaged archives and extract data beneath this repository only."""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'artifacts/manifest.json').read_text())
for row in manifest:
 archive=root/row['path']
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=row['sha256']:raise ValueError(f"Archive checksum mismatch: {archive.name}")
 with ZipFile(archive) as z:
  for entry in z.infolist():
   dest=(root/entry.filename).resolve()
   if root not in dest.parents:raise ValueError('Archive path escapes repository')
  z.extractall(root)
 print(f"Extracted {row['path']}")
