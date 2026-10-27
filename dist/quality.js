/**
 * Conservative image-quality checks, not a parking-scene detector.
 * Only empty/transparent, nearly uniform, or uniformly clipped images are refused.
 * Low texture can be valid empty asphalt, so blur/low-detail signals remain warnings.
 * Version these thresholds alongside evaluations before changing them.
 */
export const QUALITY_VERSION = 'quality-v1';
const MAX_SIDE = 224;

export function inspectPixels({data, width, height}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      !data || data.length !== width * height * 4) throw new Error('품질 검사에는 올바른 RGBA 이미지가 필요합니다.');
  const luminance = new Float32Array(width * height);
  const histogram = new Uint32Array(256);
  let count = 0, sum = 0, sumSquares = 0;
  for (let index = 0; index < luminance.length; index++) {
    const offset = index * 4;
    if (data[offset + 3] < 16) { luminance[index] = NaN; continue; }
    const value = .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];
    if (!Number.isFinite(value)) throw new Error('이미지 픽셀값이 올바르지 않습니다.');
    luminance[index] = value;
    histogram[Math.min(255, Math.max(0, Math.round(value)))]++;
    count++; sum += value; sumSquares += value * value;
  }
  const mean = count ? sum / count : 0;
  const standardDeviation = count ? Math.sqrt(Math.max(0, sumSquares / count - mean * mean)) : 0;
  function percentile(fraction) {
    const target = Math.max(1, Math.ceil(count * fraction));
    let total = 0;
    for (let value = 0; value < histogram.length; value++) { total += histogram[value]; if (total >= target) return value; }
    return 0;
  }
  const dynamicRange = count ? percentile(.99) - percentile(.01) : 0;
  let edges = 0, edgeCount = 0, laplacianSquares = 0, laplacianCount = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x, center = luminance[index];
    if (!Number.isFinite(center)) continue;
    for (const neighbor of [x + 1 < width ? luminance[index + 1] : NaN, y + 1 < height ? luminance[index + width] : NaN]) {
      if (Number.isFinite(neighbor)) { edges += Math.abs(center - neighbor); edgeCount++; }
    }
    if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
      const neighbors = [luminance[index - 1], luminance[index + 1], luminance[index - width], luminance[index + width]];
      if (neighbors.every(Number.isFinite)) {
        const laplacian = neighbors.reduce((a, b) => a + b, 0) - 4 * center;
        laplacianSquares += laplacian * laplacian; laplacianCount++;
      }
    }
  }
  const metrics = {
    meanLuminance: mean, luminanceStdDev: standardDeviation, dynamicRange,
    edgeMean: edgeCount ? edges / edgeCount : 0,
    laplacianMeanSquare: laplacianCount ? laplacianSquares / laplacianCount : 0,
    visibleFraction: count / (width * height)
  };
  const reasons = [], warnings = [];
  if (metrics.visibleFraction < .05) reasons.push({code: 'transparent', message: '보이는 이미지가 없습니다. 주차장 사진을 다시 선택해 주세요.'});
  else if (mean < 5 && standardDeviation < 3) reasons.push({code: 'dark', message: '영역이 거의 검게 표시됩니다. 밝은 주간 사진과 주차칸 위치를 확인해 주세요.'});
  else if (mean > 250 && standardDeviation < 3) reasons.push({code: 'bright', message: '영역이 거의 하얗게 표시됩니다. 빛 번짐과 주차칸 위치를 확인해 주세요.'});
  else if (standardDeviation < 1.5 && dynamicRange < 4) reasons.push({code: 'flat', message: '영역이 거의 단색입니다. 실제 주차칸 전체가 포함되도록 다시 지정해 주세요.'});
  if (!reasons.length && (metrics.edgeMean < .5 || metrics.laplacianMeanSquare < 2)) {
    warnings.push({code: 'low-detail', message: '영역의 세부 정보가 적습니다. 흐림·가림 또는 잘못 지정한 영역인지 확인해 주세요.'});
  }
  return {valid: reasons.length === 0, reasons, warnings, metrics, version: QUALITY_VERSION};
}

/** Read a bounded canvas image; large photos are sampled at at most 224px per side. */
export function inspectCanvas(canvas) {
  if (!(canvas?.width > 0 && canvas?.height > 0)) throw new Error('사진을 먼저 준비해 주세요.');
  let target = canvas;
  if (canvas.width > MAX_SIDE || canvas.height > MAX_SIDE) {
    target = document.createElement('canvas');
    const scale = MAX_SIDE / Math.max(canvas.width, canvas.height);
    target.width = Math.max(1, Math.round(canvas.width * scale));
    target.height = Math.max(1, Math.round(canvas.height * scale));
    const context = target.getContext('2d');
    if (!context) throw new Error('이미지 품질 검사를 사용할 수 없습니다.');
    context.drawImage(canvas, 0, 0, target.width, target.height);
  }
  const context = target.getContext('2d');
  if (!context) throw new Error('이미지 품질 검사를 사용할 수 없습니다.');
  return inspectPixels(context.getImageData(0, 0, target.width, target.height));
}
