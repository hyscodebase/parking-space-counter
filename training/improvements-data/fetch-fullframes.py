"""Compact date-held-out, fixed-four-space full-frame test from an attributed PKLot mirror."""
import urllib.request,json,hashlib,collections,concurrent.futures,time
from pathlib import Path
from PIL import Image,ImageDraw
BASE=Path(__file__).resolve().parent;OUT=BASE/'fullframe-test';OUT.mkdir(exist_ok=True);(OUT/'images').mkdir(exist_ok=True);(OUT/'crops').mkdir(exist_ok=True)
MIRROR='https://huggingface.co/datasets/dronefreak/PKLot/resolve/577e9c942e596819798d42fdc4d14d0b6646a43f/'
ROWS=[]
for sp in ['train','valid','test']:
 for line in (BASE/f'data__images__{sp}__metadata.jsonl').read_text().splitlines():
  r=json.loads(line);n=r['file_name'].split('_')
  if n[0]!='UFPR04' or not 9<=int(n[2])<16 or not n[1].startswith('2012'):continue
  bucket=int(hashlib.sha256(('UFPR04/'+n[1]).encode()).hexdigest()[:8],16)%10
  if bucket>=2:continue
  r['mirror_split']=sp;ROWS.append(r)
# First four official annotation boxes, fixed before any model predictions.
KEYS=[tuple(b) for b in sorted(ROWS,key=lambda r:r['file_name'])[0]['objects']['bbox'][:4]]
GROUPS=collections.defaultdict(list)
for r in ROWS:
 mp={tuple(b):v for b,v in zip(r['objects']['bbox'],r['objects']['categories'])}
 if not all(k in mp for k in KEYS):continue
 r['truth']=['empty' if mp[k]==0 else 'occupied' for k in KEYS];r['empty_count']=r['truth'].count('empty');GROUPS[r['empty_count']].append(r)
selected=[]
for count in range(5):
 candidates=sorted(GROUPS[count],key=lambda r:hashlib.sha256(('parking-four-fullframe-v1/'+r['file_name']).encode()).hexdigest())
 dates=collections.defaultdict(list)
 for r in candidates:dates[r['file_name'].split('_')[1]].append(r)
 while len([r for r in selected if r['empty_count']==count])<6:
  progressed=False
  for date in sorted(dates):
   if dates[date]:selected.append(dates[date].pop());progressed=True
   if len([r for r in selected if r['empty_count']==count])>=6:break
  if not progressed:break
selected.sort(key=lambda r:r['file_name'])
def fetch(r):
 name=r['file_name'];u=MIRROR+f'data/images/{r["mirror_split"]}/{name}';target=OUT/'images'/name
 data=target.read_bytes() if target.exists() else urllib.request.urlopen(u,timeout=60).read();target.write_bytes(data)
 im=Image.open(target).convert('RGB');width,height=im.size
 if (width,height)!=(1280,720):raise ValueError(f'Unexpected image size {im.size}')
 rois=[]
 for i,(box,truth) in enumerate(zip(KEYS,r['truth'])):
  x,y,w,h=map(int,box);crop=im.crop((x,y,x+w,y+h)).resize((224,224),Image.Resampling.BILINEAR)
  crop_path=f'crops/{Path(name).stem}-A{i+1}.rgb';(OUT/crop_path).write_bytes(crop.tobytes())
  rois.append({'id':f'A{i+1}','x':x/width,'y':y/height,'w':w/width,'h':h/height,'bbox':box,'truth':truth,'rgb_file':crop_path})
 return {'frame_id':Path(name).stem,'file':'images/'+name,'date':name.split('_')[1],'camera':'UFPR04','weather':'unverified_in_mirror','source_url':u,'source_path':f'data/images/{r["mirror_split"]}/{name}','image_sha256':hashlib.sha256(data).hexdigest(),'width':width,'height':height,'truth_empty_count':r['empty_count'],'rois':rois,'annotation_source':'dronefreak/PKLot metadata.jsonl converted from original PKLot XML contours; axis-aligned bbox and occupied flag','source_annotation':{'bbox':r['objects']['bbox'],'categories':r['objects']['categories']}}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 records=[]
 for r in pool.map(fetch,selected):records.append(r);print(f'{len(records)}/{len(selected)} {r["frame_id"]}',flush=True)
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
summary={'task':'actual full1280x720 image -> four fixed original annotation rectangles -> classification -> count','n_frames':len(records),'n_slots':len(records)*4,'empty_count_distribution':dict(collections.Counter(r['truth_empty_count'] for r in records)),'capture_dates':sorted(set(r['date'] for r in records)),'camera':'UFPR04','date_heldout_from_v1_and_v2_training':True,'selection':'six frames per true empty-count0..4, day roundrobin; condition-balanced not natural operational prevalence','roi_selection':'first4XML-derived boxes on first chronological heldoutframe, frozen before inference','fixed_bbox':KEYS,'label_source':'https://huggingface.co/datasets/dronefreak/PKLot','upstream_source':'https://web.inf.ufpr.br/vri/databases/parking-lot-database/','license':'CC BY4.0','derivative_changes':'mirror flattens filenames and converts original XML contour to axis-aligned bbox; original fullimages retained; our crop224x224 BILINEAR rawRGB','limitations':['same UFPR04 camera and December geometry only','three heldout days; temporal correlations possible','weather not inferred from mirror filenames','not a new-location generalization test','Pillow resizing/JPEG decoding can differ slightly from browser canvas']}
(OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False),flush=True)
# Human-auditable fixed ROI overlay of first frame, not model output.
im=Image.open(OUT/records[0]['file']).convert('RGB');d=ImageDraw.Draw(im)
for i,b in enumerate(KEYS):x,y,w,h=b;d.rectangle((x,y,x+w,y+h),outline='white',width=3);d.text((x+4,y+4),f'A{i+1}',fill='white')
im.save(OUT/'regions-preview.jpg',quality=92)
