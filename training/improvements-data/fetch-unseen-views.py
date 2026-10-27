"""Separate unseen-view stress test, never used for training or threshold selection."""
import urllib.request,json,hashlib,collections,concurrent.futures
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'unseen-view-test';(OUT/'images').mkdir(parents=True,exist_ok=True);(OUT/'crops').mkdir(exist_ok=True)
MIRROR='https://huggingface.co/datasets/dronefreak/PKLot/resolve/577e9c942e596819798d42fdc4d14d0b6646a43f/'
rows=[]
for sp in ['train','valid','test']:
 for line in (ROOT/f'data__images__{sp}__metadata.jsonl').read_text().splitlines():
  r=json.loads(line);n=r['file_name'].split('_')
  if n[0] not in ['UFPR05','PUCPR'] or not 9<=int(n[2])<16:continue
  r['camera']=n[0];r['date']=n[1];r['mirror_split']=sp;rows.append(r)
selected=[];boxes={}
for camera in ['UFPR05','PUCPR']:
 candidates=sorted([r for r in rows if r['camera']==camera],key=lambda r:r['file_name']);keys=[tuple(b) for b in candidates[0]['objects']['bbox'][:4]];boxes[camera]=keys;groups=collections.defaultdict(list)
 for r in candidates:
  mp={tuple(b):v for b,v in zip(r['objects']['bbox'],r['objects']['categories'])}
  if not all(k in mp for k in keys):continue
  r['truth']=['empty' if mp[k]==0 else 'occupied' for k in keys];r['truth_empty_count']=r['truth'].count('empty');groups[r['truth_empty_count']].append(r)
 for count in range(5):
  if groups[count]:selected.append(min(groups[count],key=lambda r:hashlib.sha256(('unseen-view-v1/'+r['file_name']).encode()).hexdigest()))
 print(camera,'distributionavailable',{k:len(v) for k,v in groups.items()},flush=True)
def fetch(r):
 name=r['file_name'];u=MIRROR+f'data/images/{r["mirror_split"]}/{name}';target=OUT/'images'/name;data=urllib.request.urlopen(u,timeout=60).read();target.write_bytes(data);im=Image.open(target).convert('RGB');width,height=im.size;rois=[]
 for i,(box,truth) in enumerate(zip(boxes[r['camera']],r['truth'])):
  x,y,w,h=map(int,box);crop=im.crop((x,y,x+w,y+h)).resize((224,224),Image.Resampling.BILINEAR);rgb=f'crops/{Path(name).stem}-A{i+1}.rgb';(OUT/rgb).write_bytes(crop.tobytes());rois.append({'id':f'A{i+1}','x':x/width,'y':y/height,'w':w/width,'h':h/height,'bbox':box,'truth':truth,'rgb_file':rgb})
 return {'frame_id':Path(name).stem,'camera':r['camera'],'date':r['date'],'file':'images/'+name,'width':width,'height':height,'source_url':u,'image_sha256':hashlib.sha256(data).hexdigest(),'truth_empty_count':r['truth_empty_count'],'rois':rois,'annotation_source':'unofficialdronefreak/PKLot conversionoforiginalPKLotXML','source_annotation':r['objects']}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:records=list(pool.map(fetch,selected))
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
summary={'n_frames':len(records),'n_slots':len(records)*4,'cameras':dict(collections.Counter(r['camera'] for r in records)),'selection':'oneframe pertrueemptycount0..4 perunseenview whereavailable;first4XML-derivedboxes perview fixedbeforemodelinference','source':'https://huggingface.co/datasets/dronefreak/PKLot','upstream':'PKLot UFPR VRI','license':'CC BY4.0','scope':'UFPR05 unseenviewofsamephysicalUFPRlot; PUCPR differentlot; smallstresssample notgeneralizationguarantee','training_exposure':'noUFPR05orPUCPRimagesinmodelv1/v2training','limitations':['tinyconditionbalancedsample','notnaturalprevalence','norealuserparkinglotphotos','convertedaxisalignedbboxfromoriginalXML']}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary),flush=True)
