import assert from 'node:assert/strict';
import test from 'node:test';
import {createWorkerModel} from '../dist/worker-model.js';
test('worker inference transfers copies, cancels/restarts, rejects concurrency and cleans timed-out models',async()=>{
const instances=[];
class FakeWorker {
 constructor(url){this.url=url;instances.push(this);this.mode='reply';}
 postMessage(msg,transfer){this.messages??=[];this.messages.push({msg,transfer});if(msg.type==='init'){queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}else if(this.mode==='reply')queueMicrotask(()=>this.onmessage?.({data:{type:'prediction',id:msg.id,probabilities:[.91,.09]}}));}
 terminate(){this.terminated=true;}
}
const options={Worker:FakeWorker,moduleURL:'https://parking.test/worker-model.js',loadTimeoutMs:30,predictTimeoutMs:30};
const meta={labels:['빈자리','사용 중'],modelName:'test-model'};
const data=new Uint8ClampedArray(224*224*4);data.fill(127);
const canvas={width:224,height:224,getContext:()=>({getImageData:()=>({data})})};
const model=await createWorkerModel('https://parking.test/models/parking/',meta,{version:'v2',sha256:'abc',source:'bundled'},options);
assert.equal(model.name,'test-model');assert.equal(model.version,'v2');assert.equal(model.sha256,'abc');
assert.equal((await model.predict(canvas))[0].probability,.91);
const firstWorker=instances.at(-1),sent=firstWorker.messages.at(-1);assert.equal(sent.transfer[0],sent.msg.pixels);assert.equal(sent.msg.pixels.byteLength,224*224*4);assert.equal(data.byteLength,224*224*4);
firstWorker.mode='quiet';const pending=model.predict(canvas);await Promise.resolve();await assert.rejects(model.predict(canvas),/이미 분석/);model.cancel();
const afterCancel=model.predict(canvas);await assert.rejects(pending,/취소/);assert.equal((await afterCancel)[1].probability,.09);assert.ok(firstWorker.terminated);assert.equal(instances.length,2);
instances.at(-1).mode='quiet';await assert.rejects(model.predict(canvas),/초과/);assert.ok(instances.at(-1).terminated);assert.equal((await model.predict(canvas))[0].className,'빈자리');
model.dispose();assert.ok(instances.at(-1).terminated);await assert.rejects(model.predict(canvas),/해제/);model.cancel();
class QuietWorker {constructor(){this.terminated=false;instances.push(this);}postMessage(){}terminate(){this.terminated=true;}}
await assert.rejects(createWorkerModel('https://parking.test/models/',meta,{}, {...options,Worker:QuietWorker}),/초과/);assert.ok(instances.at(-1).terminated);
await assert.rejects(createWorkerModel('https://other.test/models/',meta,{},options),/현재 사이트/);
});
