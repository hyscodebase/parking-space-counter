/** Evaluation snapshots: one saved sample per exact image, with reproducible metadata. */
const SLOTS = ['A1', 'A2', 'A3', 'A4'];
const HASH = /^[a-f0-9]{64}$/i;
const STATES = ['empty', 'occupied', 'uncertain'];

// SHA-256 fallback for local HTTP previews without SubtleCrypto. This remains an
// exact content hash; filenames, dates, random IDs and file size are not identities.
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const rotate = (x, n) => (x >>> n) | (x << (32 - n));
function sha256Fallback(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes); padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0);
  const state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = (words[i - 16] + (rotate(x,7) ^ rotate(x,18) ^ (x >>> 3)) + words[i - 7] + (rotate(y,17) ^ rotate(y,19) ^ (y >>> 10))) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = state;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^(~e&g)) + K[i] + words[i]) >>> 0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((n,i) => {state[i] = (state[i] + n) >>> 0;});
  }
  return Array.from(state, n => n.toString(16).padStart(8,'0')).join('');
}

export async function fingerprintFile(file, cryptoApi = globalThis.crypto) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('사진 파일을 다시 선택해 주세요.');
  const bytes = await file.arrayBuffer();
  if (!(bytes instanceof ArrayBuffer)) throw new Error('사진 파일을 읽을 수 없습니다.');
  if (cryptoApi?.subtle?.digest) {
    try {
      const hash = await cryptoApi.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
    } catch { /* Local previews may expose an unavailable SubtleCrypto backend. */ }
  }
  return sha256Fallback(bytes);
}

function text(value, max = 1000) { return typeof value === 'string' ? value.slice(0,max) : null; }
function iso(value) {
  const s = text(value,100);
  return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null;
}
function safeJSON(value) {
  if (value === undefined || value === null) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}
function validRois(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const rows = value.map((r,i) => {
    if (!r || r.id !== SLOTS[i] || !['x','y','w','h'].every(k=>Number.isFinite(r[k])) || r.x<0 || r.y<0 || r.w<=0 || r.h<=0 || r.x+r.w>1.000001 || r.y+r.h>1.000001) return null;
    return {id:r.id,x:r.x,y:r.y,w:r.w,h:r.h};
  });
  return rows.every(Boolean) ? rows : null;
}
function modelSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  return {name:text(value.name,200), version:text(value.version,200), source:text(value.source,500), sha256:safeJSON(value.sha256)};
}
function reasonText(value) {
  if (typeof value === 'string') return value.slice(0,1000);
  if (value && typeof value.message === 'string') return value.message.slice(0,1000);
  if (value && typeof value.code === 'string') return value.code.slice(0,1000);
  return '';
}
function normalizeRun(run) {
  if (!run || run.source !== 'model' || typeof run.frame_id !== 'string' || !run.frame_id.trim() || !Array.isArray(run.records) || run.records.length !== 4) return null;
  const hash = typeof run.image_sha256 === 'string' && HASH.test(run.image_sha256) ? run.image_sha256.toLowerCase() : null;
  // A malformed supplied hash is not silently downgraded into an unidentified sample.
  if (run.image_sha256 && !hash) return null;
  const frame = hash ? 'sha256:' + hash : run.frame_id.slice(0,200);
  const records = run.records.map((r,i) => {
    if (!r || (r.source && r.source !== 'model') || r.slot_id !== SLOTS[i] || !['empty','occupied'].includes(r.truth) || !STATES.includes(r.status)) return null;
    if (r.confidence !== null && r.confidence !== undefined && (!Number.isFinite(r.confidence) || r.confidence<0 || r.confidence>1)) return null;
    const probabilities = r.probabilities && ['empty','occupied'].every(k=>Number.isFinite(r.probabilities[k]) && r.probabilities[k]>=0 && r.probabilities[k]<=1) ? {empty:r.probabilities.empty,occupied:r.probabilities.occupied} : null;
    return {frame_id:frame,slot_id:r.slot_id,source:'model',truth:r.truth,status:r.status,confidence:r.confidence??null,probabilities,quality:safeJSON(r.quality),quality_reason:reasonText(r.quality_reason||r.reason)||null,prediction_skipped:r.prediction_skipped===true};
  });
  if (records.some(r=>!r)) return null;
  if (run.threshold !== undefined && run.threshold !== null && (!Number.isFinite(run.threshold) || run.threshold<0.5 || run.threshold>1)) return null;
  return {
    schema_version:2,frame_id:frame,source:'model',image_sha256:hash,
    identity_quality:hash?'content_sha256':'legacy_unknown',
    image_name:text(run.image_name,500), analyzed_at:iso(run.analyzed_at),
    saved_at:iso(run.saved_at), date:text(run.date,100),
    threshold:run.threshold??null,rois:validRois(run.rois),
    model:modelSnapshot(run.model),preprocessing:safeJSON(run.preprocessing),
    analysis_duration_ms:Number.isFinite(run.analysis_duration_ms)&&run.analysis_duration_ms>=0?run.analysis_duration_ms:null,
    quality:safeJSON(run.quality),records
  };
}

/** Malformed saved entries are ignored; legacy entries remain visibly unidentified. */
export function normalizeHistory(storage) {
  let rows = storage;
  if (typeof rows === 'string') {try {rows=JSON.parse(rows);} catch {return [];}}
  if (!Array.isArray(rows)) return [];
  const normalized=[];
  for (const row of rows) {
    const run=normalizeRun(row); if (!run) continue;
    const key=run.image_sha256?'image:'+run.image_sha256:'frame:'+run.frame_id;
    const at=normalized.findIndex(r=>(r.image_sha256?'image:'+r.image_sha256:'frame:'+r.frame_id)===key);
    if (at>=0) normalized.splice(at,1);
    normalized.push(run);
  }
  return normalized.slice(-100);
}

/** Reanalysis edits one photo's saved evaluation, even after ROI/model changes. */
export function upsertEvaluation(history, run, limit = 100) {
  if (!Number.isInteger(limit) || limit<1 || limit>1000) throw new Error('평가 기록 개수 제한이 올바르지 않습니다.');
  const next=normalizeRun(run);
  if (!next) throw new Error('평가 기록의 사진·정답·예측값을 확인해 주세요.');
  const rows=normalizeHistory(history).filter(r => next.image_sha256 ? r.image_sha256!==next.image_sha256 && r.frame_id!==next.frame_id : r.frame_id!==next.frame_id);
  return [...rows,next].slice(-limit);
}

const CSV_COLUMNS = [
  'frame_id','slot_id','truth','status','confidence','source',
  'image_sha256','identity_quality','image_name','analyzed_at','saved_at',
  'model_name','model_version','model_source','model_sha256','threshold','roi_json','preprocessing','analysis_duration_ms',
  'empty_probability','occupied_probability','quality_reason','quality_json','prediction_skipped'
];
function csvCell(value) {
  const serialized=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);
  // Arbitrary filenames/model names should never become spreadsheet formulas.
  const safe=/^[=+@\-\t\r]/.test(serialized)?"'"+serialized:serialized;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function exportEvaluationCSV(history) {
  const rows=normalizeHistory(history);
  const output=[CSV_COLUMNS.join(',')];
  for (const run of rows) for (const [i,record] of run.records.entries()) {
    const row={...record,image_sha256:run.image_sha256,identity_quality:run.identity_quality,image_name:run.image_name,
      analyzed_at:run.analyzed_at,saved_at:run.saved_at,model_name:run.model?.name,model_version:run.model?.version,
      model_source:run.model?.source,model_sha256:run.model?.sha256,threshold:run.threshold,roi_json:run.rois?.[i],preprocessing:run.preprocessing,analysis_duration_ms:run.analysis_duration_ms,
      empty_probability:record.probabilities?.empty,occupied_probability:record.probabilities?.occupied,
      quality_reason:record.quality_reason||reasonText(record.quality?.reason)||(Array.isArray(record.quality?.reasons)?record.quality.reasons.map(reasonText).filter(Boolean).join('; '):'')||'',quality_json:record.quality||run.quality};
    output.push(CSV_COLUMNS.map(k=>csvCell(row[k])).join(','));
  }
  return '\uFEFF'+output.join('\r\n');
}
