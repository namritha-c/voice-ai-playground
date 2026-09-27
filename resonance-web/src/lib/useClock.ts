import { useEffect, useState } from 'react';

const t0 = performance.now();
export const now = () => (performance.now() - t0) / 1000;

/** Re-renders at ~30fps and returns seconds since page load. Drives the variable-font / orb animations. */
export function useClock(fps = 30): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 1000 / fps) { last = ts; setT(now()); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return t;
}
