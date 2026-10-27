import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePhoto } from '../dist/image-input.js';

const photo = { type: 'image/jpeg', size: 1024 };
function rig(overrides = {}) {
  const events = [], image = { naturalWidth: 1200, naturalHeight: 640, decode: async () => {}, ...overrides };
  return {
    events, image,
    options: {
      createImage: () => image,
      createObjectURL: file => { events.push(['create', file]); return 'blob:test-photo'; },
      revokeObjectURL: url => events.push(['revoke', url]),
      timeoutMs: 100
    }
  };
}

test('decoded photo retains its URL until disposed, exactly once', async () => {
  const r = rig();
  const result = await preparePhoto(photo, r.options);
  assert.equal(result.url, 'blob:test-photo');
  assert.equal(result.width, 1200);
  assert.equal(result.height, 640);
  assert.equal(r.image.src, result.url);
  assert.equal(r.events.length, 1);
  result.dispose(); result.dispose();
  assert.equal(r.image.src, '');
  assert.deepEqual(r.events, [['create', photo], ['revoke', result.url]]);
});

test('invalid type, empty file and oversize file allocate no object URL', async () => {
  for (const file of [null, { ...photo, type: 'image/svg+xml' }, { ...photo, size: 0 }, { ...photo, size: NaN }, { ...photo, size: 20 * 1024 * 1024 + 1 }]) {
    const r = rig();
    await assert.rejects(preparePhoto(file, r.options));
    assert.deepEqual(r.events, []);
  }
});

test('all allowed formats and exact size limit are accepted', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const r = rig();
    const result = await preparePhoto({ type, size: 20 * 1024 * 1024 }, r.options);
    result.dispose();
    assert.equal(r.events.filter(e => e[0] === 'revoke').length, 1);
  }
});

test('corrupt-image rejection releases its URL and preserves the error', async () => {
  const failure = new Error('corrupt image');
  const r = rig({ decode: async () => { throw failure; } });
  await assert.rejects(preparePhoto(photo, r.options), error => error === failure);
  assert.deepEqual(r.events.at(-1), ['revoke', 'blob:test-photo']);
  assert.equal(r.image.src, '');
});

test('nonpositive dimensions and oversized decoded images are rejected and cleaned', async () => {
  for (const [naturalWidth, naturalHeight] of [[0, 640], [1200, -1], [NaN, 640], [10000, 6001]]) {
    const r = rig({ naturalWidth, naturalHeight });
    await assert.rejects(preparePhoto(photo, r.options));
    assert.equal(r.events.filter(e => e[0] === 'revoke').length, 1);
  }
  const r = rig({ naturalWidth: 10000, naturalHeight: 6000 });
  (await preparePhoto(photo, r.options)).dispose();
});

test('stalled decode times out and cleans up even if decoding finishes later', async () => {
  let finish;
  const r = rig({ decode: () => new Promise(resolve => { finish = resolve; }) });
  await assert.rejects(preparePhoto(photo, { ...r.options, timeoutMs: 5 }), /시간이 초과/);
  finish();
  await Promise.resolve();
  assert.equal(r.image.src, '');
  assert.equal(r.events.filter(e => e[0] === 'revoke').length, 1);
});

test('decoder construction failure releases the already-created URL', async () => {
  const r = rig();
  await assert.rejects(preparePhoto(photo, { ...r.options, createImage: () => { throw new Error('decoder unavailable'); } }), /decoder unavailable/);
  assert.deepEqual(r.events.at(-1), ['revoke', 'blob:test-photo']);
});
