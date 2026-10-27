'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const tf=require('../eval-runtime/node_modules/@tensorflow/tfjs');
const ROOT=__dirname,MODEL=path.resolve(process.argv[2]||path.join(ROOT,'../trained-model')),OUT=path.resolve(process.argv[3]||path.join(ROOT,'fullframe-test/v1-evaluation'));
const FRAMESET=path.resolve(process.argv[4]||path.join(ROOT,'fullframe-test'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 await tf.setBackend('cpu');await tf.ready();
 const quality=await import(path.join(ROOT,'quality.mjs'));
 const json=JSON.parse(fs.readFileSync(path.join(MODEL,'model.json'))),metadata=JSON.parse(fs.readFileSync(path.join(MODEL,'metadata.json'))),buffers=[],weightSpecs=[];
 for(const g of json.weightsManifest){weightSpecs.push(...g.weights);for(const p of g.paths)buffers.push(fs.readFileSync(path.join(MODEL,p)));}
 const weights=Buffer.concat(buffers),model=await tf.loadLayersModel({load:async()=>({modelTopology:json.modelTopology,weightSpecs,weightData:weights.buffer.slice(weights.byteOffset,weights.byteOffset+weights.byteLength)})});
 const frames=JSON.parse(fs.readFileSync(path.join(FRAMESET,'manifest.json'))),predictions=[];
 let slots=0,correct=0,decided=0,falseEmpty=0,occupiedTruth=0,countMatched=0,countAbsoluteError=0,slotFramesMatched=0;
 const confusion={empty:{empty:0,occupied:0,uncertain:0},occupied:{empty:0,occupied:0,uncertain:0}};
 const started=Date.now();
 for(const [fi,frame]of frames.entries()){
  const records=[];
  for(const roi of frame.rois){
   const rgb=fs.readFileSync(path.join(FRAMESET,roi.rgb_file)),rgba=new Uint8ClampedArray(224*224*4);
   for(let i=0;i<224*224;i++){rgba[i*4]=rgb[i*3];rgba[i*4+1]=rgb[i*3+1];rgba[i*4+2]=rgb[i*3+2];rgba[i*4+3]=255;}
   const check=quality.inspectPixels({data:rgba,width:224,height:224});
   const x=tf.tidy(()=>tf.tensor3d(new Uint8Array(rgb),[224,224,3]).toFloat().div(tf.scalar(127)).sub(tf.scalar(1)).expandDims()),y=model.predict(x),values=Array.from(await y.data());x.dispose();y.dispose();
   const probs=Object.fromEntries(metadata.labels.map((label,i)=>[label,values[i]])),p=probs['빈자리'],q=probs['사용 중'],confidence=Math.max(p,q);
   const status=!check.valid||confidence<.8||Math.abs(p-q)<1e-7?'uncertain':p>q?'empty':'occupied';
   records.push({slot_id:roi.id,truth:roi.truth,status,confidence,probabilities:{empty:p,occupied:q},quality:check});
   slots++;correct+=status===roi.truth;decided+=status!=='uncertain';falseEmpty+=roi.truth==='occupied'&&status==='empty';occupiedTruth+=roi.truth==='occupied';confusion[roi.truth][status]++;
  }
  const predictedEmpty=records.filter(r=>r.status==='empty').length,match=predictedEmpty===frame.truth_empty_count;
  countMatched+=match;countAbsoluteError+=Math.abs(predictedEmpty-frame.truth_empty_count);slotFramesMatched+=records.every(r=>r.status===r.truth);
  predictions.push({frame_id:frame.frame_id,camera:frame.camera,date:frame.date,truth_empty_count:frame.truth_empty_count,predicted_empty_count:predictedEmpty,count_matched:match,records});
  if((fi+1)%5===0)console.log(JSON.stringify({frames:fi+1,total:frames.length,seconds:Math.round((Date.now()-started)/1000)}));
 }
 model.dispose();fs.mkdirSync(OUT,{recursive:true});
 const report={created_at:new Date().toISOString(),model_name:metadata.modelName,model_sha256:Object.fromEntries(['model.json','metadata.json','weights.bin'].map(n=>[n,sha(fs.readFileSync(path.join(MODEL,n)))])),quality_version:quality.QUALITY_VERSION,quality_sha256:sha(fs.readFileSync(path.join(ROOT,'quality.mjs'))),threshold:.8,task:'full frame->four fixed annotation rectangles->224RGB->TM->empty count',n_frames:frames.length,n_slots:slots,dates:[...new Set(frames.map(f=>f.date))],cameras:[...new Set(frames.map(f=>f.camera))],metrics:{slot_accuracy:correct/slots,correct_slots:correct,coverage:decided/slots,uncertain:slots-decided,false_empty_count:falseEmpty,false_empty_rate_among_occupied:occupiedTruth?falseEmpty/occupiedTruth:null,occupied_truth:occupiedTruth,empty_count_exact_match_rate:countMatched/frames.length,exact_count_frames:countMatched,empty_count_mean_absolute_error:countAbsoluteError/frames.length,all_four_slots_correct_frame_rate:slotFramesMatched/frames.length,all_four_slots_correct_frames:slotFramesMatched,confusion},selection:JSON.parse(fs.readFileSync(path.join(FRAMESET,'summary.json'))).selection,source_summary:JSON.parse(fs.readFileSync(path.join(FRAMESET,'summary.json'))),limitations:['small selected sample; not real-worldsite guarantee','PillowBILINEAR RGBcrop can differ slightly from browsercanvas','labels from explicitly attributed unofficial conversion of originalPKLotXML','test balanced by trueemptycount rather than natural distribution']};
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(OUT,'predictions.json'),JSON.stringify(predictions,null,2));
 fs.writeFileSync(path.join(OUT,'REPORT.md'),`# 실제 전체사진 4칸 평가\n\n모델: ${metadata.modelName}\n\n- 전체사진 ${frames.length}장, 주차칸 ${slots}개, 카메라 ${report.cameras.join(', ')}; 촬영일 ${report.dates.join(', ')}\n- 칸별 정확도 ${(correct/slots*100).toFixed(2)}% (${correct}/${slots})\n- 빈자리 수 정확 일치 ${(countMatched/frames.length*100).toFixed(2)}% (${countMatched}/${frames.length})\n- 전체4칸 모두 정답 ${(slotFramesMatched/frames.length*100).toFixed(2)}%\n- 차량→빈자리 오류 ${falseEmpty}건 / 실제차량${occupiedTruth}칸\n- 확인 필요 ${slots-decided}칸, 확정판정비율 ${(decided/slots*100).toFixed(2)}%\n- 빈자리 개수 평균절대오차 ${(countAbsoluteError/frames.length).toFixed(3)}칸\n\n빈자리 수0~4칸 상황을 포함하도록 구성한 조건별 시험입니다. 실제발생빈도 표본이 아니며 작은 공개자료 시험으로 현장일반화 성능을 보장하지 않습니다. 원본1280x720사진에서 고정된4개XML유래직사각형을잘라평가했으며 합성패널이 아닙니다. 라벨은명시한비공식미러의원본XML변환bbox입니다. 전처리Pillow와브라우저canvas에는작은차이가있을수있습니다.\n`);
 console.log('COMPLETE '+JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
