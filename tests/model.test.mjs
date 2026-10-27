import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrediction, summarize, cropRegion, loadRemoteModel, loadLocalModel } from '../dist/model.js';

const prediction = (empty, occupied = 1 - empty) => [
  { className: '빈자리', probability: empty },
  { className: '사용 중', probability: occupied }
];

test('uncertain spaces never increase available space count', () => {
  const results = [.96, .06, .61, .9].map(p => classifyPrediction(prediction(p), .85));
  assert.deepEqual(summarize(results), { empty: 2, occupied: 1, uncertain: 1, total: 4 });
  assert.deepEqual(results[2], { status: 'uncertain', confidence: .61, probabilities: { empty: .61, occupied: .39 } });
});

test('threshold equality qualifies, below threshold does not, ties stay uncertain', () => {
  assert.equal(classifyPrediction(prediction(.85), .85).status, 'empty');
  assert.equal(classifyPrediction(prediction(.8499), .85).status, 'uncertain');
  assert.equal(classifyPrediction(prediction(.15, .85), .85).status, 'occupied');
  assert.equal(classifyPrediction(prediction(.5), .5).status, 'uncertain');
  assert.equal(classifyPrediction(prediction(1), 1).status, 'empty');
});

test('explicit labels work independently of prediction order', () => {
  const result = classifyPrediction([
    { className: 'busy', probability: .97 },
    { className: 'free', probability: .03 }
  ], .85, 'free', 'busy');
  assert.equal(result.status, 'occupied');
  assert.equal(result.confidence, .97);
});

test('reject malformed, nonbinary, missing, duplicate, and nonnormalized outputs', () => {
  for (const p of [[], prediction(.8).slice(0, 1), [...prediction(.8), { className: 'other', probability: 0 }], prediction(NaN), prediction(-.2), prediction(.8, .8), [{ className: '빈자리', probability: .8 }, { className: '빈자리', probability: .2 }]]) {
    assert.throws(() => classifyPrediction(p, .85));
  }
  assert.throws(() => classifyPrediction(prediction(.8), .85, 'Unknown', '사용 중'));
  assert.throws(() => classifyPrediction(prediction(.8), .85, '빈자리', '빈자리'));
  for (const threshold of [NaN, .4, 1.01, '0.8']) assert.throws(() => classifyPrediction(prediction(.8), threshold));
});

test('summary rejects unknown status instead of silently counting it as free', () => {
  assert.deepEqual(summarize([]), { empty: 0, occupied: 0, uncertain: 0, total: 0 });
  assert.throws(() => summarize([{ status: 'pending' }]));
});

test('crop translates normalized ROI to full pixel rectangle', () => {
  let called;
  const canvas = { getContext: () => ({ drawImage: (...args) => { called = args; } }) };
  const original = globalThis.document;
  globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return canvas; } };
  try {
    const image = { naturalWidth: 1600, naturalHeight: 900 };
    assert.equal(cropRegion(image, { x: .25, y: .2, w: .3, h: .5 }), canvas);
    assert.deepEqual(called, [image, 400, 180, 480, 450, 0, 0, 224, 224]);
    assert.equal(canvas.width, 224);
    assert.equal(canvas.height, 224);
  } finally { globalThis.document = original; }
});

test('crop rejects invalid areas and unloaded images', () => {
  const image = { width: 100, height: 100 };
  for (const roi of [{ x: -.1, y: 0, w: .2, h: .2 }, { x: .9, y: 0, w: .2, h: .2 }, { x: 0, y: 0, w: 0, h: .2 }, { x: 0, y: NaN, w: .2, h: .2 }]) assert.throws(() => cropRegion(image, roi));
  assert.throws(() => cropRegion({}, { x: 0, y: 0, w: 1, h: 1 }));
});

const file = (name, data) => ({ name, size: JSON.stringify(data).length, text: async () => JSON.stringify(data) });
const metadata = { labels: ['빈자리', '사용 중'], packageName: '@teachablemachine/image', imageSize: 224 };
const topology = { modelTopology: {}, weightsManifest: [{ paths: ['a.bin', 'b.bin'], weights: [] }] };

test('file loader checks metadata and every shard before starting runtime', async () => {
  await assert.rejects(loadLocalModel([]), /model.json/);
  await assert.rejects(loadLocalModel([file('model.json', topology), file('metadata.json', metadata), file('a.bin', {})]), /b.bin/);
  await assert.rejects(loadLocalModel([file('model.json', topology), file('metadata.json', { labels: ['one', 'two', 'three'] })]), /두 클래스/);
});

test('model URLs must be HTTPS without embedded credentials', async () => {
  for (const url of ['bad', 'http://localhost:8080/', 'javascript:alert(1)', 'https://user:password@example.com/model/']) await assert.rejects(loadRemoteModel(url));
});

test('local multi-shard loader passes all files and releases only the loaded model', async () => {
  let ioFiles, disposed = 0;
  globalThis.tf = { ready: async () => {}, io: { browserFiles: files => { ioFiles = files; return { local: true }; } } };
  globalThis.tmImage = { load: async (io, meta) => {
    assert.deepEqual(io, { local: true });
    assert.deepEqual(meta.labels, metadata.labels);
    return {
      model: { inputs: [{ shape: [null, 224, 224, 3] }], dispose: () => disposed++ },
      getClassLabels: () => metadata.labels,
      getTotalClasses: () => 2,
      predict: async (_canvas, flip) => { assert.equal(flip, false); return prediction(.95); }
    };
  } };
  const model = await loadLocalModel([file('metadata.json', metadata), file('b.bin', {}), file('model.json', topology), file('a.bin', {})]);
  assert.deepEqual(ioFiles.map(f => f.name), ['model.json', 'a.bin', 'b.bin']);
  assert.deepEqual(model.classes, metadata.labels);
  assert.equal(classifyPrediction(await model.predict({}), .85).status, 'empty');
  model.dispose(); model.dispose();
  assert.equal(disposed, 1);
  await assert.rejects(model.predict({}), /다시 연결/);
});
