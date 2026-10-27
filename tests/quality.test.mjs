import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPixels, inspectCanvas, QUALITY_VERSION} from '../dist/quality.js';

function raster(width = 64, height = 64, pixel = () => [127, 127, 127, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return {data, width, height};
}
test('gray image that the classifier confidently calls empty is refused before classification', () => {
  const quality = inspectPixels(raster());
  assert.equal(quality.valid, false);
  assert.equal(quality.reasons[0].code, 'flat');
  assert.ok(Math.abs(quality.metrics.meanLuminance - 127) < .0001);
  assert.equal(quality.version, QUALITY_VERSION);
});
test('uniformly black, clipped-white and invisible regions are refused with specific reasons', () => {
  for (const [pixel, reason] of [[[0, 0, 0, 255], 'dark'], [[255, 255, 255, 255], 'bright'], [[0, 0, 0, 0], 'transparent']]) {
    const quality = inspectPixels(raster(64, 64, () => pixel));
    assert.equal(quality.valid, false);
    assert.equal(quality.reasons[0].code, reason);
  }
});
test('low-detail gradient is warned, not rejected as a non-parking scene', () => {
  const quality = inspectPixels(raster(64, 64, x => [90 + x, 90 + x, 90 + x, 255]));
  assert.equal(quality.valid, true);
  assert.equal(quality.warnings[0].code, 'low-detail');
});
test('textured image passes and quality checking does not claim semantic recognition', () => {
  const quality = inspectPixels(raster(64, 64, (x, y) => {const p = ((x >> 2) + (y >> 2)) % 2 ? 90 : 180; return [p, p, p, 255];}));
  assert.equal(quality.valid, true);
  assert.deepEqual(quality.reasons, []);
  assert.deepEqual(quality.warnings, []);
});
test('small clipped minority does not reject a normally textured image', () => {
  const quality = inspectPixels(raster(64, 64, (x, y) => {const p = x < 2 ? 255 : 80 + ((x * 7 + y * 11) % 90); return [p, p, p, 255];}));
  assert.equal(quality.valid, true);
});
test('RGBA data shape is validated and canvas helper reads expected pixels', () => {
  assert.throws(() => inspectPixels({data: [], width: 64, height: 64}), /RGBA/);
  assert.throws(() => inspectPixels({data: [], width: 0, height: 0}), /RGBA/);
  let args;
  const pixels = raster();
  const result = inspectCanvas({width: 64, height: 64, getContext: () => ({getImageData: (...values) => {args = values; return pixels;}})});
  assert.deepEqual(args, [0, 0, 64, 64]);
  assert.equal(result.valid, false);
});
