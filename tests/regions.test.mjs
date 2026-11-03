import test from 'node:test';
import assert from 'node:assert/strict';
import {sameRegions, validateRegions, regionWarnings, isSlotId, MAX_REGIONS} from '../dist/regions.js';

test('saving unchanged ROI coordinates preserves demo compatibility after number rounding', () => {
  const original = ['A1','A2','A3','A4'].map((id,i)=>({id,x:.105+i*.205,y:.24,w:.175,h:.55}));
  const roundTrip = original.map(r=>Object.fromEntries(Object.entries(r).map(([key,value])=>[key,key==='id'?value:Math.round(value*1000)/1000])));
  assert.equal(sameRegions(original, roundTrip), true);
});
test('real coordinate, identity, missing-region, and invalid-number changes are not equivalent', () => {
  const base=[{id:'A1',x:.1,y:.2,w:.3,h:.4}];
  assert.equal(sameRegions(base,[{...base[0],x:.102}]),false);
  assert.equal(sameRegions(base,[{...base[0],id:'A2'}]),false);
  assert.equal(sameRegions(base,[]),false);
  assert.equal(sameRegions(base,[{...base[0],x:NaN}]),false);
});

const four = () => ['A1', 'A2', 'A3', 'A4'].map((id, i) => ({id, x: i * .25, y: 0, w: .25, h: 1}));
test('four distinct regions validate and only supported numeric coordinates are returned', () => {
  const value = four().map(region => ({...region, ignored: 'metadata'}));
  assert.deepEqual(validateRegions(value), four());
  assert.deepEqual(regionWarnings(value), []);
});
test('one physical rectangle cannot be counted as several parking spaces', () => {
  const value = four();
  value[1] = {...value[0], id: 'A2', x: value[0].x + 1e-8};
  assert.throws(() => validateRegions(value), /A1와 A2가 같은 영역/);
});
test('malformed, out-of-frame and zero-size regions are rejected', () => {
  for (const change of [r => {r[0].x = -.01;}, r => {r[0].h = 0;}, r => {r[3].w = .3;}, r => {r[0].x = '0';}, r => {r[0] = null;}, r => {r[0].id = 'A2';}]) {
    const value = four(); change(value); assert.throws(() => validateRegions(value));
  }
});
test('one, ten, twenty and one hundred distinct parking spaces are supported', () => {
  assert.equal(MAX_REGIONS, 100);
  for (const count of [1, 10, 20, 100]) {
    const value = Array.from({length: count}, (_, i) => ({id: `A${i + 1}`, x: (i % 10) / 10, y: Math.floor(i / 10) / 10, w: .09, h: .09}));
    assert.deepEqual(validateRegions(value), value);
    assert.deepEqual(regionWarnings(value), []);
  }
});
test('unique supported IDs may have gaps and need not be numerically ordered', () => {
  const value = four().slice(0, 3);
  [value[0].id, value[1].id, value[2].id] = ['A100', 'A7', 'A1'];
  assert.deepEqual(validateRegions(value), value);
  for (const id of ['A1', 'A9', 'A10', 'A99', 'A100']) assert.equal(isSlotId(id), true);
  for (const id of ['A0', 'A01', 'A101', 'B1', 'A1 ', 1, null]) assert.equal(isSlotId(id), false);
});
test('empty or oversized sets, invalid IDs and nonfinite coordinates are rejected', () => {
  for (const value of [null, {}, [], Array.from({length: 101}, () => four()[0])]) assert.throws(() => validateRegions(value));
  for (const id of ['A0', 'A01', 'A101', 'B1', 1]) {
    const value = four(); value[0].id = id; assert.throws(() => validateRegions(value));
  }
  for (const coordinate of [NaN, Infinity, -Infinity]) {
    const value = four(); value[0].x = coordinate; assert.throws(() => validateRegions(value));
  }
});
test('two different rectangles cannot reuse a slot ID', () => {
  const value = four(); value[3].id = 'A1';
  assert.throws(() => validateRegions(value), /A1.*ID가 중복/);
});
test('large overlap warns without banning perspective overlap; adjacent edges do not warn', () => {
  const value = four(); value[1] = {...value[0], id: 'A2', x: .05};
  const validated = validateRegions(value);
  assert.equal(validated.length, 4);
  const warning = regionWarnings(value).find(w => w.ids.join(',') === 'A1,A2');
  assert.ok(warning.iou > .5);
  assert.equal(warning.code, 'overlap');
  assert.deepEqual(regionWarnings(four()), []);
});
