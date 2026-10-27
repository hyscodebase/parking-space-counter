'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const tf=require('../eval-runtime/node_modules/@tensorflow/tfjs');
const tm=require('../eval-runtime/node_modules/@teachablemachine/image');
const jpeg=require('../eval-runtime/node_modules/jpeg-js');
const root=__dirname,output=path.resolve(process.argv[3]||path.join(root,'trained-model-v2')),base=path.resolve(process.argv[4]||path.join(root,'../tm-base-mobilenet-v2-035')),dataset=path.resolve(process.argv[2]||path.join(root,'dataset-v2'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function loader(dir){const j=JSON.parse(fs.readFileSync(path.join(dir,'model.json'))),spec=[],buf=[];for(const g of j.weightsManifest){spec.push(...g.weights);for(const p of g.paths)buf.push(fs.readFileSync(path.join(dir,p)));}const b=Buffer.concat(buf);return{load:async()=>({modelTopology:j.modelTopology,weightSpecs:spec,weightData:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)})};}
(async()=>{
 await tf.setBackend('cpu');await tf.ready();
 const labels=['빈자리','사용 중'];
 const manifest=JSON.parse(fs.readFileSync(path.join(dataset,'manifest.json')));
 const rows=manifest.filter(r=>r.split==='train').sort((a,b)=>a.label.localeCompare(b.label)||a.file.localeCompare(b.file));
 if(rows.length!==456||rows.filter(r=>r.label==='empty').length!==228||rows.filter(r=>r.label==='occupied').length!==228)throw Error('Expected228 per class');
 const params={denseUnits:100,epochs:50,learningRate:0.001,batchSize:16};
 const provenance={method:'Official @teachablemachine/image0.8.3 Node API; web UI training froze',package:'@teachablemachine/image',package_version:'0.8.3',tensorflow_js:'1.3.1',backend:'cpu',input_gradient_training_images:386,internal_validation_images:70,base_sha256:Object.fromEntries(fs.readdirSync(base).filter(n=>n==='model.json'||n.endsWith('.bin')).map(n=>[n,hash(fs.readFileSync(path.join(base,n)))])),base_model:'MobileNetV2 alpha0.35 224, out_relu + globalAveragePooling2d',base_url:'https://storage.googleapis.com/teachable-machine-models/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_0.35_224_no_top/model.json',normalization:'RGB / 127 - 1',classes:labels,seed:'parking-four-weather-v2',params,input_images:456,images_per_class:228,selection:'All456realUFPR04trainingcrops:Sunny100+Cloudy100+Rainy28perclass; no duplication; datesdisjoint holdouts',internal_validation:'Official library stratified random15% of provided training images;35/class held out internally;386gradienttraining+70internalvalidation',external_validation_images:150,external_test_images:150,external_holdouts_used_for_training:false,started_at:new Date().toISOString(),weather_counts:JSON.parse(fs.readFileSync(path.join(dataset,'summary.json'))).counts,date_split_policy:JSON.parse(fs.readFileSync(path.join(dataset,'summary.json'))).date_policy,prior_holdout_exposure:JSON.parse(fs.readFileSync(path.join(dataset,'summary.json'))).prior_exposure,training_files:rows.map(r=>({file:r.file,date:r.date,weather:r.weather,camera:r.camera,original_sha256:r.original_sha256,prepared_sha256:hash(fs.readFileSync(path.join(dataset,r.file)))}))};
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'training-provenance.json'),JSON.stringify(provenance,null,2));
 const teachable=await tm.createTeachable({labels,modelName:'빈자리 v2 · 주간·날씨 보강',userMetadata:{trainingMethod:'official-library-node',provenanceFile:'training-provenance.json'}},{checkpointUrl:loader(base),trainingLayer:'out_relu'});
 teachable.setLabels(labels);teachable.setSeed(provenance.seed);
 console.log('Official MobileNet loaded; extracting456 image embeddings');
 const started=Date.now();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],decoded=jpeg.decode(fs.readFileSync(path.join(dataset,r.file)),{useTArray:true});
  if(decoded.width!==224||decoded.height!==224)throw Error('Unexpected image dimensions');
  const raster={width:decoded.width,height:decoded.height,getContext:()=>({getImageData:()=>decoded})};
  await teachable.addExample(r.label==='empty'?0:1,raster);
  if(i===0||((i+1)%10===0))console.log(JSON.stringify({phase:'features',done:i+1,total:rows.length,elapsed_seconds:(Date.now()-started)/1000}));
 }
 // Feature embeddings are intermediate and are not included in deliverables.
 const epochs=[];
 await teachable.train(params,{onEpochEnd:async(epoch,logs)=>{const entry={epoch:epoch+1,...logs};epochs.push(entry);console.log(JSON.stringify({phase:'train',...entry}));fs.writeFileSync(path.join(output,'training-history.json'),JSON.stringify(epochs,null,2));}});
 await teachable.save({save:async a=>{const json={format:'layers-model',generatedBy:'TensorFlow.js tfjs-layers'+(tf.version['tfjs-layers']||''),convertedBy:null,modelTopology:a.modelTopology,weightsManifest:[{paths:['weights.bin'],weights:a.weightSpecs}]};fs.writeFileSync(path.join(output,'model.json'),JSON.stringify(json));fs.writeFileSync(path.join(output,'weights.bin'),Buffer.from(a.weightData));return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON',modelTopologyBytes:JSON.stringify(a.modelTopology).length,weightSpecsBytes:JSON.stringify(a.weightSpecs).length,weightDataBytes:a.weightData.byteLength}};}});
 fs.writeFileSync(path.join(output,'metadata.json'),JSON.stringify(teachable.getMetadata(),null,2));
 provenance.completed_at=new Date().toISOString();provenance.elapsed_seconds=(Date.now()-started)/1000;provenance.final_epoch=epochs.at(-1);provenance.hashes=Object.fromEntries(['model.json','metadata.json','weights.bin'].map(n=>[n,hash(fs.readFileSync(path.join(output,n)))]));
 fs.writeFileSync(path.join(output,'training-provenance.json'),JSON.stringify(provenance,null,2));
 console.log('COMPLETE '+JSON.stringify({output,elapsed_seconds:provenance.elapsed_seconds,final_epoch:provenance.final_epoch,hashes:provenance.hashes}));
 teachable.model.dispose();
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
