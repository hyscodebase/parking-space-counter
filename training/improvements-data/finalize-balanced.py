"""Choose genuine, per-weather class-balanced data from the bounded official stream collection."""
from pathlib import Path
from collections import defaultdict
import json,hashlib,shutil
ROOT=Path(__file__).resolve().parent;SRC=ROOT/'balanced-v2-weather';DST=ROOT/'dataset-v2';DST.mkdir(exist_ok=True)
rows=json.loads((SRC/'manifest.json').read_text());groups=defaultdict(list)
for row in rows:groups[row['split'],row['weather'],row['label']].append(row)
selected=[];serial=defaultdict(int)
for split in ['train','validation','test']:
 for weather in ['Sunny','Cloudy','Rainy']:
  limit=min(len(groups[split,weather,label]) for label in ['empty','occupied'])
  for label in ['empty','occupied']:
   subset=sorted(groups[split,weather,label],key=lambda row:hashlib.sha256(('balanced-v2/'+row['source']).encode()).hexdigest())[:limit]
   for row in subset:
    copied=dict(row);name=f'{split}/{label}/{weather.lower()}-{serial[split,label]:04d}.jpg';serial[split,label]+=1;target=DST/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy(SRC/row['file'],target);copied.update(collection_file=row['file'],file=name,prepared_sha256=hashlib.sha256(target.read_bytes()).hexdigest());selected.append(copied)
dates={split:sorted(set(row['date'] for row in selected if row['split']==split)) for split in ['train','validation','test']}
for a in dates:
 for b in dates:
  if a!=b:assert not set(dates[a])&set(dates[b]),'Date overlap'
assert len(set(row['original_sha256'] for row in selected))==len(selected)
assert len(set(row['prepared_sha256'] for row in selected))==len(selected)
counts={str(key):len([row for row in selected if (row['split'],row['weather'],row['label'])==key]) for key in groups}
summary={'total':len(selected),'counts':counts,'dates':dates,'date_overlap':False,'camera':'UFPR04','selection':'Sun/Cloud100perclass train; Rainy28perclass train(real available balanced minimum); validation/test25perclass/weather; no duplication','initial_goal':'600train/150validation/150test,100trainperclass/weather','actual_train':sum(row['split']=='train' for row in selected),'actual_validation':sum(row['split']=='validation' for row in selected),'actual_test':sum(row['split']=='test' for row in selected),'reason':'compressedstreambudget1.8GB reached;28uniqueRainyemptytrain available,100Rainyoccupied trimmedto28toavoidclass-weatherconfounding','fullframe_test_dates_disjoint_train':not(set(dates['train'])&{'2012-12-12','2012-12-20','2012-12-27'}),'source':'https://www.inf.ufpr.br/vri/databases/PKLot.tar.gz','license':'CC BY4.0','date_policy':'originalsha(date)split,all2013-01-17movedtest,all2013-01-21movedvalidation; originalexternaltest/validationdates nevertrain','prior_exposure':'v1 externalvalidation included2013-01-17previously evaluated; no v2 training orhyperparameter tuning onholdouts'}
(DST/'manifest.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2));(DST/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False))
