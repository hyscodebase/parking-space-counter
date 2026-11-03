import test from 'node:test';
import assert from 'node:assert/strict';
import {countVehicles} from '../dist/counting.js';

const results = statuses => statuses.map((status, index) => ({id: `A${index + 1}`, status}));

test('four classified spaces report the number occupied rather than the number empty', () => {
  assert.deepEqual(countVehicles(results(['occupied', 'empty', 'occupied', 'empty'])), {
    occupied: 2, empty: 2, uncertain: 0, total: 4, min: 2, max: 2, exact: true
  });
});

test('ten spaces can count ten vehicles without a four-space limit', () => {
  assert.deepEqual(countVehicles(results(Array(10).fill('occupied'))), {
    occupied: 10, empty: 0, uncertain: 0, total: 10, min: 10, max: 10, exact: true
  });
});

test('twenty spaces retain uncertainty in the count range', () => {
  const value = results([...Array(13).fill('occupied'), ...Array(4).fill('empty'), ...Array(3).fill('uncertain')]);
  assert.deepEqual(countVehicles(value), {
    occupied: 13, empty: 4, uncertain: 3, total: 20, min: 13, max: 16, exact: false
  });
});

test('no confirmed cars does not imply zero when any space is uncertain', () => {
  assert.deepEqual(countVehicles(results(['empty', 'uncertain'])), {
    occupied: 0, empty: 1, uncertain: 1, total: 2, min: 0, max: 1, exact: false
  });
  assert.equal(countVehicles(results(['empty'])).exact, true);
  assert.equal(countVehicles(results(['empty'])).max, 0);
});

test('one hundred distinct spaces and noncontiguous valid IDs are supported', () => {
  assert.equal(countVehicles(results(Array(100).fill('occupied'))).occupied, 100);
  assert.deepEqual(countVehicles([{id: 'A100', status: 'occupied'}, {id: 'A7', status: 'empty'}]), {
    occupied: 1, empty: 1, uncertain: 0, total: 2, min: 1, max: 1, exact: true
  });
});

test('duplicate space IDs cannot inflate the number of vehicles', () => {
  assert.throws(() => countVehicles([{id: 'A1', status: 'occupied'}, {id: 'A1', status: 'occupied'}]), /중복/);
});

test('unknown or nonfinite statuses and malformed sets cannot produce a count', () => {
  for (const status of ['car', '', NaN, Infinity, undefined, null]) {
    assert.throws(() => countVehicles([{id: 'A1', status}]));
  }
  for (const value of [undefined, {}, [], [null], results(Array(101).fill('empty'))]) {
    assert.throws(() => countVehicles(value));
  }
  for (const id of ['A0', 'A01', 'A101', 'B1', undefined, NaN]) {
    assert.throws(() => countVehicles([{id, status: 'occupied'}]));
  }
});
