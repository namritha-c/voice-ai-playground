import { useEffect, useRef, useState } from 'react';

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: Rgb) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Darkens `hex` toward black by `k` (0 keeps it, 1 is black). */
export function shade(hex: string, k: number): string {
  return toHex(toRgb(hex).map((v) => v * (1 - k)) as Rgb);
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/**
 * Cross-fades a fixed-length palette toward `target` over `ms` whenever `target` changes.
 * Steps at ~30fps, which is plenty for slow ambient colour and cheap to re-render.
 */
export function useBlendedPalette<T extends readonly string[]>(target: T, ms = 900): string[] {
  const [shown, setShown] = useState<string[]>([...target]);
  const from = useRef<string[]>([...target]);
  const key = target.join();

  useEffect(() => {
    const start = from.current.map(toRgb), end = target.map(toRgb);
    const t0 = performance.now();
    let raf = 0, last = 0;
    const step = (ts: number) => {
      const k = Math.min(1, (ts - t0) / ms);
      if (k === 1 || ts - last > 32) {
        last = ts;
        const mixed = start.map((s, i) => toHex(s.map((v, j) => v + (end[i][j] - v) * easeInOut(k)) as Rgb));
        from.current = mixed;
        setShown(mixed);
      }
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `key` stands in for the array identity of `target`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  return shown;
}
