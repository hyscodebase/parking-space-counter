import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {fingerprintFile,normalizeHistory,upsertEvaluation,exportEvaluationCSV} from '../dist/evaluation.js';
const hash='a'.repeat(64),hash2='b'.repeat(64);
const roi=Array.from({length:4},(_,i)=>({id:'A'+(i+1),x:i*.25,y:0,w:.25,h:1}));
const run=(overrides={})=>({frame_id:'random-1',source:'model',image_sha256:hash,image_name:'parking.jpg',analyzed_at:'2026-10-27T01:02:03.000Z',saved_at:'2026-10-27T01:03:00.000Z',threshold:.8,rois:roi,model:{name:'PKLot','version':'v2',sha256:{'model.json':'c'.repeat(64),'weights.bin':'d'.repeat(64)}},preprocessing:'RGB224x224 /127-1',records:Array.from({length:4},(_,i)=>({slot_id:'A'+(i+1),source:'model',truth:i%2?'occupied':'empty',status:i%2?'occupied':'empty',confidence:.95,probabilities:{empty:i%2?.05:.95,occupied:i%2?.95:.05},quality:{valid:true,reasons:[],metrics:{luminanceStd:30}}})),...overrides});
const file=bytes=>({arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});

test('same image content has identical SHA256 in secure and HTTP preview environments',async()=>{
  for(const value of ['', 'abc', '중복 사진 식별', 'a'.repeat(1000)]){
    const bytes=new TextEncoder().encode(value),expected=createHash('sha256').update(bytes).digest('hex');
    assert.equal(await fingerprintFile(file(bytes),undefined),expected);
    assert.equal(await fingerprintFile(file(bytes),webcrypto),expected);
    assert.equal(await fingerprintFile(file(bytes),{}),expected);
  }
  const bytes=Uint8Array.from({length:100000},(_,i)=>i%256);
  assert.equal(await fingerprintFile(file(bytes),{}),createHash('sha256').update(bytes).digest('hex'));
  await assert.rejects(fingerprintFile({}),/다시 선택/);
});

test('same photo reanalysis replaces its saved sample regardless of random ID, model or ROI',()=>{
  let history=upsertEvaluation([],run());
  const updated=run({frame_id:'different-run',model:{name:'new-model',version:'v3',sha256:'e'.repeat(64)},rois:roi.map(r=>({...r,w:.2}))});
  history=upsertEvaluation(history,updated);
  assert.equal(history.length,1);
  assert.equal(history[0].frame_id,'sha256:'+hash);
  assert.equal(history[0].model.name,'new-model');
  assert.equal(history[0].rois[0].w,.2);
  assert.ok(history[0].records.every(r=>r.frame_id==='sha256:'+hash));
  assert.equal(history[0].identity_quality,'content_sha256');
});

test('distinct images remain independent and newest image edits appear once at the end',()=>{
  let history=upsertEvaluation([],run());
  history=upsertEvaluation(history,run({image_sha256:hash2,frame_id:'random-2'}));
  assert.equal(history.length,2);
  history=upsertEvaluation(history,run({frame_id:'random-3'}));
  assert.deepEqual(history.map(r=>r.image_sha256),[hash2,hash]);
  assert.equal(upsertEvaluation(history,run({image_sha256:'c'.repeat(64)}),2).length,2);
});

test('legacy records survive normalization with explicit unknown identity and no invented analysis timestamp',()=>{
  const legacy=run({image_sha256:undefined,analyzed_at:undefined,model:undefined,rois:undefined,threshold:undefined,date:'2026. 10. 27. 오후 1:00'});
  const saved=normalizeHistory(JSON.stringify([legacy]));
  assert.equal(saved.length,1);
  assert.equal(saved[0].identity_quality,'legacy_unknown');
  assert.equal(saved[0].analyzed_at,null);
  assert.equal(saved[0].model,null);
  assert.equal(saved[0].threshold,null);
  assert.deepEqual(normalizeHistory(saved),saved);
  assert.equal(upsertEvaluation(saved,{...legacy,date:'updated'}).length,1);
});

test('malformed, incomplete, demo and non-probability history entries are ignored',()=>{
  const bad=[null,{},run({source:'demo'}),run({image_sha256:'not-a-hash'}),run({threshold:Infinity}),run({records:run().records.slice(1)}),run({records:run().records.map((r,i)=>i? r:{...r,confidence:2})}),run({records:run().records.map((r,i)=>i? r:{...r,truth:'unknown'})}),run({records:run().records.map((r,i)=>i? r:{...r,source:'demo'})})];
  assert.deepEqual(normalizeHistory(bad),[]);
  assert.deepEqual(normalizeHistory('{bad'),[]);
  assert.deepEqual(normalizeHistory({}),[]);
  assert.throws(()=>upsertEvaluation([],bad[3]),/評価|평가/);
  assert.throws(()=>upsertEvaluation([],run(),0),/제한/);
  assert.equal(normalizeHistory([run(),run({frame_id:'same-photo-again'})]).length,1);
});

// Small RFC4180 reader exercises actual quoted output, including embedded newlines.
function readCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell.replace(/\r$/,''));rows.push(row);return rows;
}
test('CSV keeps evaluation tool columns and immutable analysis/model/ROI/quality context',()=>{
  const value=run({image_name:'a,"photo"\nline.jpg'});
  value.records[0].status='uncertain';value.records[0].quality={valid:false,reasons:['too flat'],metrics:{luminanceStd:0}};
  const csv=exportEvaluationCSV([value]);
  assert.ok(csv.startsWith('\uFEFF'));
  const [header,...rows]=readCSV(csv.slice(1)),asObjects=rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
  assert.deepEqual(header.slice(0,6),['frame_id','slot_id','truth','status','confidence','source']);
  assert.equal(rows.length,4);
  const first=asObjects[0];
  assert.equal(first.frame_id,'sha256:'+hash);
  assert.equal(first.image_sha256,hash);
  assert.equal(first.image_name,value.image_name);
  assert.equal(first.analyzed_at,value.analyzed_at);
  assert.equal(first.threshold,'0.8');
  assert.deepEqual(JSON.parse(first.model_sha256),value.model.sha256);
  assert.deepEqual(JSON.parse(first.roi_json),roi[0]);
  assert.equal(first.preprocessing,value.preprocessing);
  assert.equal(first.quality_reason,'too flat');
  assert.equal(first.status,'uncertain');
  assert.equal(first.empty_probability,'0.95');
});

test('spreadsheet formula-like filenames and model names are neutralized in CSV',()=>{
  const [header,...rows]=readCSV(exportEvaluationCSV([run({image_name:'=HYPERLINK("x")',model:{name:'@SUM(1)',version:'-1'}})]).slice(1));
  const first=Object.fromEntries(header.map((h,i)=>[h,rows[0][i]]));
  assert.equal(first.image_name,'\'=HYPERLINK("x")');
  assert.equal(first.model_name,"'@SUM(1)");
});


test('malformed optional quality metadata does not break legacy CSV export',()=>{
  const value=run();value.records[0].quality={reasons:'not-an-array'};
  assert.doesNotThrow(()=>exportEvaluationCSV([value]));
});


test('structured preprocessing, quality messages, skipped prediction and model origin survive snapshot and CSV',()=>{
  const preprocessing={version:2,resize:'full ROI224',normalization:'RGB/127-1',quality:'v1'};
  const value=run({preprocessing,analysis_duration_ms:1234.5,model:{name:'PKLot',source:'bundled:parking-v2',sha256:'c'.repeat(64)}});
  value.records[0].status='uncertain';value.records[0].prediction_skipped=true;value.records[0].reason='입력 품질 확인';
  value.records[1].quality={valid:false,reasons:[{code:'flat',message:'단색 영역입니다.'}]};
  const saved=normalizeHistory([value])[0];
  assert.deepEqual(saved.preprocessing,preprocessing);
  assert.equal(saved.analysis_duration_ms,1234.5);
  assert.equal(saved.model.source,'bundled:parking-v2');
  assert.equal(saved.records[0].quality_reason,'입력 품질 확인');
  assert.equal(saved.records[0].prediction_skipped,true);
  const [header,...rows]=readCSV(exportEvaluationCSV([value]).slice(1));
  const objects=rows.map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]])));
  assert.deepEqual(JSON.parse(objects[0].preprocessing),preprocessing);
  assert.equal(objects[0].analysis_duration_ms,'1234.5');
  assert.equal(objects[0].model_source,'bundled:parking-v2');
  assert.equal(objects[0].prediction_skipped,'true');
  assert.equal(objects[1].quality_reason,'단색 영역입니다.');
});
