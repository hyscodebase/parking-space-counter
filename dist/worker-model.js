/** Bundled-model inference in a classic worker, keeping CPU work off the UI thread. */
export async function createWorkerModel(baseURL, metadata, identity = {}, {
  Worker: WorkerConstructor = globalThis.Worker,
  loadTimeoutMs = 25000,
  predictTimeoutMs = 30000,
  moduleURL = import.meta.url
} = {}) {
  const labels = metadata?.labels;
  if (!Array.isArray(labels) || labels.length !== 2 || labels.some(label => typeof label !== 'string' || !label.trim()) || labels[0] === labels[1]) {
    throw new Error('빈자리와 사용 중 두 클래스가 있는 모델이 필요합니다.');
  }
  if (typeof WorkerConstructor !== 'function') throw new Error('이 브라우저에서는 백그라운드 분석을 사용할 수 없습니다.');
  if (![loadTimeoutMs, predictTimeoutMs].every(ms => Number.isFinite(ms) && ms > 0)) throw new Error('모델 제한 시간이 올바르지 않습니다.');
  const base = new URL(baseURL, moduleURL);
  if (!['http:', 'https:'].includes(base.protocol) || base.origin !== new URL(moduleURL).origin) {
    throw new Error('기본 모델은 현재 사이트에서 불러와야 합니다.');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  let worker = null, readyPromise = null, readyPending = null, predictionPending = null;
  let disposed = false, generation = 0, sequence = 0, activeRequest = null;

  function stop(error) {
    generation++;
    worker?.terminate(); worker = null; readyPromise = null;
    const loading = readyPending, predicting = predictionPending;
    readyPending = predictionPending = null; activeRequest = null;
    if (loading) { clearTimeout(loading.timer); loading.reject(error); }
    if (predicting) { clearTimeout(predicting.timer); predicting.reject(error); }
  }
  function start() {
    if (disposed) return Promise.reject(new Error('모델 연결을 해제했습니다. 다시 연결해 주세요.'));
    if (readyPromise) return readyPromise;
    const currentGeneration = ++generation;
    readyPromise = new Promise((resolve, reject) => {
      readyPending = {resolve, reject, timer: setTimeout(() => stop(new Error('기본 모델을 준비하는 시간이 초과됐습니다. 다시 시도해 주세요.')), loadTimeoutMs)};
      try {
        worker = new WorkerConstructor(new URL('./inference-worker.js', moduleURL));
        worker.onmessage = event => {
          if (generation !== currentGeneration) return;
          const message = event.data;
          if (message?.type === 'ready' && readyPending) {
            const pending = readyPending; readyPending = null;
            clearTimeout(pending.timer); pending.resolve();
          } else if (message?.type === 'prediction' && predictionPending?.id === message.id) {
            const pending = predictionPending; predictionPending = null;
            clearTimeout(pending.timer);
            const probabilities = message.probabilities;
            if (!Array.isArray(probabilities) || probabilities.length !== 2 ||
                probabilities.some(p => !Number.isFinite(p) || p < 0 || p > 1) ||
                Math.abs(probabilities[0] + probabilities[1] - 1) > .01) {
              pending.reject(new Error('모델의 확률값이 올바르지 않습니다. 다시 분석해 주세요.'));
            } else pending.resolve(labels.map((className, i) => ({className, probability: probabilities[i]})));
          } else if (message?.type === 'error') {
            stop(new Error(message.message || '백그라운드 모델 분석에 실패했습니다.'));
          }
        };
        worker.onerror = () => { if (generation === currentGeneration) stop(new Error('백그라운드 모델을 실행하지 못했습니다. 다시 시도해 주세요.')); };
        worker.onmessageerror = () => { if (generation === currentGeneration) stop(new Error('모델과 이미지 데이터를 주고받지 못했습니다.')); };
        worker.postMessage({type: 'init', baseURL: base.href});
      } catch (error) { stop(error instanceof Error ? error : new Error('백그라운드 모델을 시작하지 못했습니다.')); }
    });
    return readyPromise;
  }

  try { await start(); } catch (error) { stop(error); throw error; }
  return {
    classes: labels.slice(),
    name: metadata.modelName && metadata.modelName !== 'untitled' ? metadata.modelName : 'PKLot 주간 주차 모델',
    version: identity.version ?? metadata.userMetadata?.version ?? null,
    sha256: identity.sha256 ?? null,
    source: identity.source ?? 'bundled',
    async predict(canvas) {
      if (disposed) throw new Error('모델 연결을 해제했습니다. 다시 연결해 주세요.');
      if (activeRequest !== null) throw new Error('이미 분석 중입니다. 현재 분석이 끝난 뒤 다시 시도해 주세요.');
      const id = ++sequence; activeRequest = id;
      try {
        if (canvas?.width !== 224 || canvas?.height !== 224) throw new Error('분석 이미지는 224×224여야 합니다.');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('분석 이미지의 픽셀을 읽을 수 없습니다.');
        const data = context.getImageData(0, 0, 224, 224).data;
        if (data.length !== 224 * 224 * 4) throw new Error('분석 이미지의 형식이 올바르지 않습니다.');
        const pixels = new Uint8Array(data);
        await start();
        if (disposed || activeRequest !== id) throw new Error('분석을 취소했습니다.');
        return await new Promise((resolve, reject) => {
          predictionPending = {id, resolve, reject, timer: setTimeout(() => stop(new Error('분석 시간이 초과됐습니다. 다시 시도해 주세요.')), predictTimeoutMs)};
          try { worker.postMessage({type: 'predict', id, width: 224, height: 224, pixels: pixels.buffer}, [pixels.buffer]); }
          catch (error) { stop(error instanceof Error ? error : new Error('분석 이미지를 전달하지 못했습니다.')); }
        });
      } finally { if (activeRequest === id) activeRequest = null; }
    },
    cancel() { if (!disposed) stop(new Error('분석을 취소했습니다.')); },
    dispose() { if (!disposed) { disposed = true; stop(new Error('모델 연결을 해제했습니다.')); } }
  };
}
