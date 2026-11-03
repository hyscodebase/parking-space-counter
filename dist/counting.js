import {isSlotId, MAX_REGIONS} from './regions.js';

/** Count only the specified, classified spaces; an uncertain space may hold a car. */
export function countVehicles(results) {
  if (!Array.isArray(results) || results.length < 1 || results.length > MAX_REGIONS) {
    throw new Error(`차량 수를 계산하려면 1~${MAX_REGIONS}개 주차칸의 판정이 필요합니다.`);
  }
  const counts = {occupied: 0, empty: 0, uncertain: 0, total: results.length};
  const ids = new Set();
  for (const result of results) {
    if (!result || !isSlotId(result.id)) throw new Error('차량 수를 계산할 주차칸 ID가 올바르지 않습니다.');
    if (ids.has(result.id)) throw new Error(`${result.id}가 중복되어 차량 수를 계산할 수 없습니다.`);
    ids.add(result.id);
    if (!['empty', 'occupied', 'uncertain'].includes(result.status)) {
      throw new Error(`${result.id}의 주차칸 판정이 올바르지 않습니다.`);
    }
    counts[result.status]++;
  }
  return {...counts, min: counts.occupied, max: counts.occupied + counts.uncertain, exact: counts.uncertain === 0};
}
