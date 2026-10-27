"""Download pinned mirror metadata required by the compact full-frame selection scripts."""
import json,urllib.request,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
COMMIT='577e9c942e596819798d42fdc4d14d0b6646a43f'
BASE=f'https://huggingface.co/datasets/dronefreak/PKLot/resolve/{COMMIT}/'
files=['README.md','data/images/train/metadata.jsonl','data/images/valid/metadata.jsonl','data/images/test/metadata.jsonl']
hashes={}
for n in files:
 target=ROOT/n.replace('/','__')
 if not target.exists():target.write_bytes(urllib.request.urlopen(BASE+n,timeout=60).read())
 hashes[n]=hashlib.sha256(target.read_bytes()).hexdigest();print(n,target.stat().st_size,flush=True)
(ROOT/'mirror-provenance.json').write_text(json.dumps({'repo':'dronefreak/PKLot','repo_commit':COMMIT,'file_sha256':hashes},indent=2))
