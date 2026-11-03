/** Numeric form/JSON round trips can differ in the least significant bits. */
export function sameRegions(left, right, epsilon = 1e-6) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((region, i) => region?.id === right[i]?.id &&
    ['x', 'y', 'w', 'h'].every(key => Number.isFinite(region[key]) &&
      Number.isFinite(right[i][key]) && Math.abs(region[key] - right[i][key]) <= epsilon));
}

export const MAX_REGIONS = 100;
const SLOT_ID = /^A(?:[1-9]|[1-9][0-9]|100)$/;

export function isSlotId(value) {
  return typeof value === 'string' && SLOT_ID.test(value);
}

/** Validate normalized rectangles without rejecting legitimate perspective overlap. */
export function validateRegions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REGIONS) throw new Error(`주차칸 영역은 1~${MAX_REGIONS}개를 지정해 주세요.`);
  const ids = new Set();
  const regions = value.map((region, i) => {
    if (!region || !isSlotId(region.id)) throw new Error(`${i + 1}번째 주차칸 ID는 A1~A${MAX_REGIONS} 중 하나여야 합니다.`);
    if (ids.has(region.id)) throw new Error(`${region.id} 주차칸 ID가 중복되었습니다. 서로 다른 ID를 지정해 주세요.`);
    ids.add(region.id);
    if (!['x', 'y', 'w', 'h'].every(key => Number.isFinite(region[key])) ||
      region.x < 0 || region.y < 0 || region.w <= 0 || region.h <= 0 ||
      region.x + region.w > 1.000001 || region.y + region.h > 1.000001) {
      throw new Error(region.id + ' 영역이 사진을 벗어났거나 올바르지 않습니다.');
    }
    return {id: region.id, x: region.x, y: region.y, w: region.w, h: region.h};
  });
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      if (['x', 'y', 'w', 'h'].every(key => Math.abs(regions[i][key] - regions[j][key]) <= 1e-6)) {
        throw new Error(`${regions[i].id}와 ${regions[j].id}가 같은 영역입니다. 서로 다른 주차칸을 지정해 주세요.`);
      }
    }
  }
  return regions;
}

export function regionWarnings(value) {
  const regions = validateRegions(value);
  const warnings = [];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j];
      const intersection = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
        Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const iou = intersection / (a.w * a.h + b.w * b.h - intersection);
      if (iou > 0.5) warnings.push({
        code: 'overlap', ids: [a.id, b.id], iou,
        message: `${a.id}와 ${b.id} 영역이 많이 겹칩니다. 서로 다른 주차칸인지 확인해 주세요.`
      });
    }
  }
  return warnings;
}
