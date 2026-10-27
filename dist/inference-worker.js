/* Classic worker: official TM 0.8.3 pixel normalization with the saved LayersModel. */
let parkingModel = null, initializing = false, predicting = false;

function failure(error) {
  self.postMessage({type: 'error', message: error instanceof Error ? error.message : '모델 분석에 실패했습니다.'});
}

self.onmessage = async event => {
  const message = event.data;
  if (message?.type === 'init') {
    if (initializing || parkingModel) { failure(new Error('모델이 이미 준비 중입니다.')); return; }
    initializing = true;
    try {
      const base = new URL(message.baseURL);
      if (base.origin !== self.location.origin || !['http:', 'https:'].includes(base.protocol)) throw new Error('현재 사이트의 기본 모델이 필요합니다.');
      importScripts('./vendor/tf.min.js');
      await self.tf.setBackend('cpu');
      await self.tf.ready();
      const model = await self.tf.loadLayersModel(new URL('model.json', base).href);
      const input = model.inputs?.[0]?.shape, output = model.outputs?.[0]?.shape;
      if (model.inputs.length !== 1 || input?.length !== 4 || input[1] !== 224 || input[2] !== 224 || input[3] !== 3 ||
          model.outputs.length !== 1 || output?.length !== 2 || output[1] !== 2) {
        model.dispose(); throw new Error('224×224 RGB 입력과 두 클래스 출력이 있는 기본 모델이 필요합니다.');
      }
      parkingModel = model;
      self.postMessage({type: 'ready'});
    } catch (error) { failure(error); }
    finally { initializing = false; }
  } else if (message?.type === 'predict') {
    if (!parkingModel || predicting) { failure(new Error('모델 준비 상태를 확인해 주세요.')); return; }
    predicting = true;
    let input, output;
    try {
      const rgba = new Uint8Array(message.pixels);
      if (message.width !== 224 || message.height !== 224 || rgba.length !== 224 * 224 * 4) throw new Error('분석 이미지 형식이 올바르지 않습니다.');
      const rgb = new Float32Array(224 * 224 * 3);
      for (let pixel = 0; pixel < 224 * 224; pixel++) {
        for (let channel = 0; channel < 3; channel++) rgb[pixel * 3 + channel] = rgba[pixel * 4 + channel];
      }
      // Keep both Float32 tensor operations, matching TM capture() rather than
      // normalizing in JavaScript double precision before the tensor is created.
      input = self.tf.tidy(() => self.tf.tensor4d(rgb, [1, 224, 224, 3]).div(127).sub(1));
      output = parkingModel.predict(input);
      const probabilities = Array.from(await output.data());
      self.postMessage({type: 'prediction', id: message.id, probabilities});
    } catch (error) { failure(error); }
    finally { input?.dispose(); output?.dispose(); predicting = false; }
  }
};
