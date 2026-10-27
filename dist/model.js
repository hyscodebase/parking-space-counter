import {fingerprintFile} from './evaluation.js';
import {createWorkerModel} from './worker-model.js';
/** Binary parking classifier helpers. No trained weights or demo predictions live here. */
const TF_URL = './vendor/tf.min.js';
const TM_URL = './vendor/teachablemachine-image.min.js';
let runtimePromise;

function binaryLabels(labels) {
  if (!Array.isArray(labels) || labels.length !== 2 || labels.some(x => typeof x !== 'string' || !x.trim()) || labels[0] === labels[1]) {
    throw new Error('빈자리와 사용 중, 서로 다른 두 클래스가 있는 이미지 모델이 필요합니다.');
  }
  return labels;
}

export function classifyPrediction(predictions, threshold = 0.85, emptyClass = '빈자리', occupiedClass = '사용 중') {
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) throw new Error('판정 기준은 0.5~1 사이여야 합니다.');
  binaryLabels([emptyClass, occupiedClass]);
  if (!Array.isArray(predictions) || predictions.length !== 2) throw new Error('두 클래스의 예측값이 필요합니다.');
  binaryLabels(predictions.map(p => p?.className));
  const empty = predictions.find(p => p.className === emptyClass)?.probability;
  const occupied = predictions.find(p => p.className === occupiedClass)?.probability;
  if (![empty, occupied].every(p => Number.isFinite(p) && p >= 0 && p <= 1) || Math.abs(empty + occupied - 1) > 0.01) {
    throw new Error('클래스 연결 또는 모델의 확률값을 확인해 주세요.');
  }
  const confidence = Math.max(empty, occupied);
  const status = confidence < threshold || Math.abs(empty - occupied) < 1e-7 ? 'uncertain' : empty > occupied ? 'empty' : 'occupied';
  return { status, confidence, probabilities: { empty, occupied } };
}

export function summarize(results) {
  const counts = { empty: 0, occupied: 0, uncertain: 0, total: 0 };
  for (const result of results) {
    if (!['empty', 'occupied', 'uncertain'].includes(result.status)) throw new Error('유효하지 않은 주차칸 상태입니다.');
    counts[result.status] += 1;
    counts.total += 1;
  }
  return counts;
}

export function cropRegion(image, roi, size = 224) {
  const { x, y, w, h } = roi || {};
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.000001 || y + h > 1.000001) {
    throw new Error('주차칸 영역이 사진을 벗어났거나 크기가 올바르지 않습니다.');
  }
  if (!Number.isInteger(size) || size < 16 || size > 2048) throw new Error('이미지 크기가 올바르지 않습니다.');
  const width = image.naturalWidth || image.videoWidth || image.width;
  const height = image.naturalHeight || image.videoHeight || image.height;
  if (!(width > 0 && height > 0)) throw new Error('사진을 먼저 불러와 주세요.');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지 처리를 사용할 수 없습니다.');
  // Resize the complete chosen rectangle, matching the dataset preparation utility.
  ctx.drawImage(image, x * width, y * height, w * width, h * height, 0, 0, size, size);
  return canvas;
}

function script(src, available) {
  if (available()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const element = document.createElement('script');
    let finished = false;
    const finish = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      element.onload = element.onerror = null;
      if (error) { element.remove(); reject(error); } else resolve();
    };
    const timer = setTimeout(() => finish(new Error('AI 라이브러리 연결 시간이 초과됐습니다. 인터넷 연결을 확인해 주세요.')), 25000);
    element.src = src;
    element.async = true;
    element.crossOrigin = 'anonymous';
    element.onload = () => finish(available() ? undefined : new Error('AI 라이브러리를 초기화하지 못했습니다.'));
    element.onerror = () => finish(new Error('AI 라이브러리를 불러오지 못했습니다. 인터넷 연결 또는 브라우저 차단 설정을 확인해 주세요.'));
    document.head.append(element);
  });
}

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await script(TF_URL, () => !!globalThis.tf);
      await script(TM_URL, () => !!globalThis.tmImage);
      if (typeof globalThis.tf.setBackend === 'function') await globalThis.tf.setBackend('cpu');
      await globalThis.tf.ready();
      return { tf: globalThis.tf, tm: globalThis.tmImage };
    })().catch(error => { runtimePromise = null; throw error; });
  }
  return runtimePromise;
}

function disposeRaw(model) {
  // TM 0.8's dispose() targets its training-only truncatedModel; loaded models use model.
  if (model?.model?.dispose) model.model.dispose();
  else model?.dispose?.();
}

async function deadline(promise, ms, label, cleanup) {
  let timer;
  let timedOut = false;
  const work = Promise.resolve(promise).then(value => {
    if (timedOut) cleanup?.(value);
    return value;
  });
  try {
    return await Promise.race([work, new Promise((_, reject) => {
      timer = setTimeout(() => { timedOut = true; reject(new Error(label)); }, ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function fetchJSON(url, credentials = 'omit') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials });
    if (!response.ok) throw new Error(`모델 파일을 불러오지 못했습니다 (HTTP ${response.status}).`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('모델 서버의 응답 시간이 초과됐습니다.');
    if (error instanceof SyntaxError) throw new Error('모델 JSON 파일이 올바르지 않습니다.');
    throw error;
  } finally { clearTimeout(timer); }
}

function validateMetadata(metadata) {
  binaryLabels(metadata?.labels);
  if (metadata.packageName && metadata.packageName !== '@teachablemachine/image') throw new Error('티처블 머신 이미지 모델을 선택해 주세요.');
  return metadata;
}

function wrap(model, metadata, name, identity = {}) {
  try {
    const classes = binaryLabels(model.getClassLabels()).slice();
    if (model.getTotalClasses() !== 2) throw new Error('모델 출력은 빈자리와 사용 중 두 클래스여야 합니다.');
    const inputShape = model.model?.inputs?.[0]?.shape;
    if (inputShape && (inputShape.length !== 4 || inputShape[1] !== inputShape[2] || ![1, 3].includes(inputShape[3]))) {
      throw new Error('정사각형 이미지 입력을 받는 티처블 머신 모델이 필요합니다.');
    }
    let disposed = false;
    return {
      classes,
      version: identity.version || metadata.timeStamp || metadata.packageVersion || null,
      sha256: identity.sha256 || null,
      source: identity.source || null,
      name: metadata.modelName && metadata.modelName !== 'untitled' ? metadata.modelName : name,
      async predict(canvas) {
        if (disposed) throw new Error('모델을 다시 연결해 주세요.');
        return await model.predict(canvas, false);
      },
      dispose() { if (!disposed) { disposed = true; disposeRaw(model); } }
    };
  } catch (error) { disposeRaw(model); throw error; }
}

export async function loadRemoteModel(baseUrl) {
  let url;
  try { url = new URL(String(baseUrl).trim()); } catch { throw new Error('올바른 모델 URL을 입력해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('https://로 시작하는 공개 모델 URL을 사용해 주세요.');
  if (url.pathname.endsWith('/model.json') || url.pathname.endsWith('/metadata.json')) url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
  else if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.hash = '';
  url.search = '';
  const metadata = validateMetadata(await fetchJSON(new URL('metadata.json', url).href));
  const { tm } = await runtime();
  try {
    const model = await deadline(tm.load(new URL('model.json', url).href, metadata), 90000, '모델 다운로드 시간이 초과됐습니다. URL과 연결 상태를 확인해 주세요.', disposeRaw);
    return wrap(model, metadata, '연결된 이미지 모델', {source:url.href});
  } catch (error) {
    if (error instanceof TypeError) throw new Error('모델에 연결할 수 없습니다. URL, 인터넷 연결, 모델 서버의 CORS 설정을 확인해 주세요.');
    throw error;
  }
}

export async function loadLocalModel(files) {
  const selected = Array.from(files || []);
  const modelFile = selected.find(f => f.name === 'model.json');
  const metadataFile = selected.find(f => f.name === 'metadata.json');
  if (!modelFile || !metadataFile) throw new Error('model.json, metadata.json, 모든 .bin 가중치 파일을 함께 선택해 주세요.');
  if (selected.reduce((n, f) => n + f.size, 0) > 250 * 1024 * 1024) throw new Error('모델 파일은 합계 250MB 이하로 선택해 주세요.');
  let modelJSON, metadata;
  try { [modelJSON, metadata] = await Promise.all([modelFile.text().then(JSON.parse), metadataFile.text().then(JSON.parse)]); }
  catch { throw new Error('model.json 또는 metadata.json의 JSON 형식이 올바르지 않습니다.'); }
  validateMetadata(metadata);
  if (!modelJSON.modelTopology || !Array.isArray(modelJSON.weightsManifest)) throw new Error('TensorFlow.js 형식으로 내보낸 이미지 모델이 필요합니다.');
  const paths = modelJSON.weightsManifest.flatMap(group => group.paths || []);
  if (!paths.length || paths.some(path => typeof path !== 'string')) throw new Error('모델 가중치 목록이 올바르지 않습니다.');
  const basename = path => path.replace(/\\/g, '/').split('/').pop();
  const weights = paths.map(path => {
    const matches = selected.filter(f => f.name === basename(path));
    if (matches.length !== 1) throw new Error(`가중치 파일을 확인해 주세요: ${basename(path)}`);
    return matches[0];
  });
  if (new Set(weights).size !== weights.length) throw new Error('중복된 이름의 가중치 파일은 지원하지 않습니다.');
  const { tm, tf } = await runtime();
  // tmImage.load forwards its first argument to tf.loadLayersModel. browserFiles
  // supplies all shards, unlike TM's three-argument loadFromFiles convenience API.
  const io = tf.io.browserFiles([modelFile, ...weights]);
  const model = await deadline(tm.load(io, metadata), 90000, '모델을 읽는 시간이 초과됐습니다. 파일 크기와 형식을 확인해 주세요.', disposeRaw);
  const sha256={};for(const file of [modelFile,metadataFile,...weights]){if(typeof file.arrayBuffer==='function')sha256[file.name]=await fingerprintFile(file);}
  return wrap(model, metadata, '로컬 이미지 모델', {source:'local-files',sha256:Object.keys(sha256).length?sha256:null});
}

/** Bundled official Teachable Machine model, served with this private site. */
export async function loadBundledModel() {
  const base = new URL('./models/parking/', import.meta.url);
  const metadata = validateMetadata(await fetchJSON(new URL('metadata.json', base).href, 'same-origin'));
  let provenance;try{provenance=await fetchJSON(new URL('training-provenance.json',base).href,'same-origin');}catch{}
  const identity={source:'bundled',version:provenance?.model_version||metadata.timeStamp,sha256:provenance?.hashes||null};
  if(typeof globalThis.Worker==='function'){
    try{return await createWorkerModel(base.href,metadata,identity);}catch(error){console.warn('Background inference unavailable; using CPU fallback.',error.message);}
  }
  const { tm } = await runtime();
  const model = await deadline(tm.load(new URL('model.json', base).href, metadata), 90000, '기본 모델을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.', disposeRaw);
  return wrap(model, metadata, 'PKLot 주간 주차 모델', identity);
}
