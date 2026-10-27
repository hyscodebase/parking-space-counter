"""Streaming balanced UFPR04 patch subset from official PKLot; dates keep v1 split buckets."""
import urllib.request,tarfile,hashlib,json,io,time
from pathlib import Path
from collections import Counter
from PIL import Image
ROOT=Path(__file__).resolve().parent/'balanced-v2-weather'
URL='https://www.inf.ufpr.br/vri/databases/PKLot.tar.gz'
QUOTAS={'train':100,'validation':25,'test':25}
MAX_COMPRESSED=1800*1024*1024
rows=[];counts=Counter();source_hashes=set();ROOT.mkdir(exist_ok=True)
for split in QUOTAS:
 for label in ['empty','occupied']:(ROOT/split/label).mkdir(parents=True,exist_ok=True)
class LimitedReader:
 def __init__(self,r):self.r=r;self.n=0
 def read(self,n=-1):
  if self.n>=MAX_COMPRESSED:raise RuntimeError('Compressed-byte budget reached')
  b=self.r.read(n);self.n+=len(b);return b
started=time.monotonic();stop_reason='all quotas completed';last=started
try:
 with urllib.request.urlopen(URL,timeout=60) as response:
  reader=LimitedReader(response)
  with tarfile.open(fileobj=reader,mode='r|gz') as tar:
   for i,m in enumerate(tar):
    parts=m.name.split('/')
    if len(parts)!=7 or parts[1]!='PKLotSegmented' or parts[2]!='UFPR04' or not m.name.endswith('.jpg'):continue
    _,_,camera,weather,date,label,filename=parts;label=label.lower()
    if label not in ['empty','occupied'] or weather not in ['Sunny','Cloudy','Rainy']:continue
    try:hour=int(filename.split('_')[1])
    except (IndexError,ValueError):continue
    if not 9<=hour<16:continue
    bucket=int(hashlib.sha256((camera+'/'+date).encode()).hexdigest()[:8],16)%10
    split='test' if bucket<2 else 'validation' if bucket<4 else 'train'
    if date=='2013-01-17':split='test'
    if date=='2013-01-21':split='validation'
    key=(split,weather,label)
    if counts[key]>=QUOTAS[split]:continue
    data=tar.extractfile(m).read();sha=hashlib.sha256(data).hexdigest()
    if sha in source_hashes:continue
    with Image.open(io.BytesIO(data)) as im:
     im=im.convert('RGB').resize((224,224),Image.Resampling.BILINEAR)
     target=f'{split}/{label}/{weather.lower()}-{counts[key]:04d}.jpg';im.save(ROOT/target,quality=93)
    counts[key]+=1;source_hashes.add(sha)
    rows.append({'file':target,'source':m.name,'camera':camera,'weather':weather,'date':date,'label':label,'split':split,'original_sha256':sha})
    if len(rows)%50==0 or time.monotonic()-last>60:
     (ROOT/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(json.dumps({'done':len(rows),'counts':{str(k):v for k,v in counts.items()},'compressed_mb':round(reader.n/1024**2,1),'seconds':round(time.monotonic()-started)}),flush=True);last=time.monotonic()
    if len(rows)==sum(QUOTAS.values())*6:break
except Exception as e:stop_reason=f'{type(e).__name__}: {e}'
(ROOT/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
summary={'source':URL,'license':'CC BY4.0','counts':{str(k):v for k,v in counts.items()},'total':len(rows),'expected':sum(QUOTAS.values())*6,'complete':len(rows)==sum(QUOTAS.values())*6,'stop_reason':stop_reason,'split_method':'sha256(camera/date) mod10 0-1test,2-3validation,4-9train; entire2013-01-17oldvalidation movedtest forrainyholdout; entire2013-01-21oldtrain movedvalidation; oldtest dates nevertrain', 'prior_holdout_exposure':'v1 externalvalidation dates were previously evaluated; no v2 training/tuning on externaltest; v2 hyperparameters frozen50epochs,batch16,lr.001','preprocess':'RGB224x224 BILINEAR, JPEG quality93','compressed_bytes':reader.n,'elapsed_seconds':round(time.monotonic()-started)}
(ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False),flush=True)
