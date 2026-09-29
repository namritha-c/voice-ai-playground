// Browser-side audio: capture, conversion to 16 kHz mono WAV, waveform peaks, and live level metering.

const TARGET_RATE = 16000;
let _ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') void _ctx.resume();
  return _ctx;
}

/** Shared analyser so the orb can react to whatever is playing or being recorded. */
let _analyser: AnalyserNode | null = null;
export function analyser(): AnalyserNode {
  if (!_analyser) {
    _analyser = audioCtx().createAnalyser();
    _analyser.fftSize = 256;
    _analyser.smoothingTimeConstant = 0.7;
  }
  return _analyser;
}
const _buf = new Uint8Array(128);
/** 0..1 RMS-ish level of the current signal feeding the analyser. */
export function level(): number {
  const a = analyser();
  a.getByteTimeDomainData(_buf);
  let s = 0;
  for (let i = 0; i < _buf.length; i++) { const v = (_buf[i] - 128) / 128; s += v * v; }
  return Math.min(1, Math.sqrt(s / _buf.length) * 3.2);
}
/** Frequency bins (0..1) for driving bars. */
const _fbuf = new Uint8Array(128);
export function spectrum(): Uint8Array {
  analyser().getByteFrequencyData(_fbuf);
  return _fbuf;
}

const connected = new WeakSet<HTMLMediaElement>();
/** Route an <audio> element through the analyser (once per element). */
export function meter(el: HTMLMediaElement) {
  if (connected.has(el)) return;
  const ctx = audioCtx();
  const src = ctx.createMediaElementSource(el);
  src.connect(analyser());
  src.connect(ctx.destination);
  connected.add(el);
}

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  startedAt: number;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = audioCtx();
  const src = ctx.createMediaStreamSource(stream);
  src.connect(analyser());
  const mr = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mr.start(250);
  const release = () => { src.disconnect(); stream.getTracks().forEach((t) => t.stop()); };
  return {
    startedAt: performance.now(),
    cancel: () => { try { mr.stop(); } catch { /* already stopped */ } release(); },
    stop: () => new Promise<Blob>((resolve, reject) => {
      mr.onstop = () => { release(); resolve(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); };
      mr.onerror = () => { release(); reject(new Error('recording failed')); };
      mr.stop();
    }),
  };
}

/** Decode any browser-playable audio and re-encode as 16 kHz mono 16-bit WAV (what every provider accepts). */
export async function toWav16k(blob: Blob): Promise<{ wav: Blob; duration: number; peaks: number[] }> {
  const buf = await audioCtx().decodeAudioData(await blob.arrayBuffer());
  const frames = Math.max(1, Math.ceil(buf.duration * TARGET_RATE));
  const off = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  const pcm = out.getChannelData(0);
  return { wav: encodeWav(pcm, TARGET_RATE), duration: buf.duration, peaks: peaksOf(pcm, 100) };
}

export function encodeWav(pcm: Float32Array, rate: number): Blob {
  const n = pcm.length;
  const b = new ArrayBuffer(44 + n * 2);
  const v = new DataView(b);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([b], { type: 'audio/wav' });
}

/** Normalised 0..1 peak envelope with `n` buckets. */
export function peaksOf(pcm: Float32Array, n: number): number[] {
  const step = Math.max(1, Math.floor(pcm.length / n));
  const out: number[] = [];
  let max = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (let j = i * step, e = Math.min(pcm.length, (i + 1) * step); j < e; j++) { const a = Math.abs(pcm[j]); if (a > p) p = a; }
    out.push(p);
    if (p > max) max = p;
  }
  return out.map((p) => (max ? p / max : 0));
}

const peakCache = new Map<string, number[]>();
export async function peaksFromUrl(url: string, n = 120): Promise<number[]> {
  const k = `${url}#${n}`;
  const hit = peakCache.get(k);
  if (hit) return hit;
  const res = await fetch(url);
  const buf = await audioCtx().decodeAudioData(await res.arrayBuffer());
  const p = peaksOf(buf.getChannelData(0), n);
  peakCache.set(k, p);
  return p;
}
