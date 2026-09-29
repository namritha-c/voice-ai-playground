// Visual helpers ported from the design's script block.
export const ACCENTS = { tts: '#FF6A2B', stt: '#A6E35A', sts: '#B9A2FF' } as const;
export const CAP_STYLE = {
  tts: ['TTS', '#FF6A2B', 'rgba(255,106,43,0.10)'],
  stt: ['STT', '#A6E35A', 'rgba(166,227,90,0.10)'],
  sts: ['STS', '#B9A2FF', 'rgba(185,162,255,0.10)'],
} as const;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·';

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export function fmt(x: number): string {
  if (!(x >= 0)) x = 0;
  const m = Math.floor(x / 60), s = x - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
export const fvs = (w: number, opsz: number, soft: number, wonk: number) =>
  `'wght' ${Math.round(w)}, 'opsz' ${opsz}, 'SOFT' ${soft}, 'WONK' ${wonk}`;

export function blobPath(r0: number, amp: number, t: number, k: number, n: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = r0 + amp * (0.5 * Math.sin(3 * th + t * 1.3 * k) + 0.35 * Math.sin(5 * th - t * 0.9 + k) + 0.4 * Math.sin(2 * th + t * 0.6 * k + 2 * k));
    pts.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  let d = '';
  for (let j = 0; j < n; j++) {
    const p = pts[j], q = pts[(j + 1) % n];
    if (j === 0) { const z = pts[n - 1]; d += `M${((z[0] + p[0]) / 2).toFixed(1)} ${((z[1] + p[1]) / 2).toFixed(1)}`; }
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}

/** Glyph-scramble decode effect: returns the text partially scrambled for a short time after it changes. */
export class Decoder {
  private seen = new Map<string, { text: string; t: number }>();
  get(key: string, text: string, t: number): string {
    let d = this.seen.get(key);
    if (!d || d.text !== text) { d = { text, t }; this.seen.set(key, d); }
    const el = t - d.t;
    if (el > 0.2 + text.length * 0.03) return text;
    return text.split('').map((ch, i) => (ch === ' ' || ch === '·' ? ch : el < 0.12 + i * 0.03 ? GLYPHS[(Math.floor(t * 40) + i * 7) % GLYPHS.length] : ch)).join('');
  }
}
