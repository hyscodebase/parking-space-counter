/** Decode a photo before replacing the current view. No upload or server request. */
export async function preparePhoto(file, {
  createImage = () => new Image(),
  createObjectURL = value => URL.createObjectURL(value),
  revokeObjectURL = value => URL.revokeObjectURL(value),
  timeoutMs = 20000
} = {}) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG, WebP 사진을 선택해주세요.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
    throw new Error('비어 있지 않은 20 MB 이하의 사진을 선택해주세요.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('사진 읽기 제한 시간이 올바르지 않습니다.');

  const url = createObjectURL(file);
  let image, timer, disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    // Stop the detached decoder as well as releasing its blob URL.
    try { if (image) image.src = ''; } finally { revokeObjectURL(url); }
  };
  try {
    image = createImage();
    image.src = url;
    await Promise.race([
      Promise.resolve().then(() => image.decode()),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('사진을 읽는 시간이 초과됐습니다. 다른 사진을 선택해주세요.')), timeoutMs);
      })
    ]);
    const width = image.naturalWidth, height = image.naturalHeight;
    if (![width, height].every(n => Number.isInteger(n) && n > 0)) {
      throw new Error('사진의 크기를 읽을 수 없습니다. 다른 사진을 선택해주세요.');
    }
    if (width * height > 60000000) {
      throw new Error('사진 해상도가 너무 큽니다. 6천만 화소 이하로 줄여주세요.');
    }
    return { url, width, height, dispose };
  } catch (error) {
    dispose();
    throw error instanceof Error ? error : new Error('사진을 읽을 수 없습니다.');
  } finally {
    clearTimeout(timer);
  }
}
