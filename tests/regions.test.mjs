import test from 'node:test';
import assert from 'node:assert/strict';
import {sameRegions, validateRegions, regionWarnings} from '../dist/regions.js';

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
test('malformed, missing, out-of-frame and zero-size regions are rejected', () => {
  for (const change of [r => {r[0].x = -.01;}, r => {r[0].h = 0;}, r => {r[3].w = .3;}, r => {r[0].x = '0';}, r => {r[0] = null;}, r => {r[0].id = 'A2';}]) {
    const value = four(); change(value); assert.throws(() => validateRegions(value));
  }
  assert.throws(() => validateRegions(four().slice(0, 3)));
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
