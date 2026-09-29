'use client';

import { LiquidMetal } from '@paper-design/shaders-react';
import { useEffect, useState } from 'react';

const SIZE = 200;
const LINE = 1.05;
const PAD_X = SIZE * 0.08, PAD_Y = SIZE * 0.14;

export interface Line { text: string; italic?: boolean }
const asLines = (t: string | Line[]): Line[] => (typeof t === 'string' ? [{ text: t, italic: true }] : t);
const fontFor = (l: Line) => `${l.italic ? 'italic 800' : '700'} ${SIZE}px Fraunces, Georgia, serif`;

/** Rasterises the lines in the page's serif to a transparent PNG, the mask shape the liquid metal shader wants. */
async function rasterise(lines: Line[]): Promise<{ url: string; ratio: number }> {
  await Promise.all(lines.map((l) => document.fonts.load(fontFor(l), l.text)));
  const probe = document.createElement('canvas').getContext('2d')!;
  const widest = Math.max(...lines.map((l) => { probe.font = fontFor(l); return probe.measureText(l.text).width; }));
  const w = Math.ceil(widest + PAD_X * 2), h = Math.ceil(SIZE * LINE * lines.length + PAD_Y * 2);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000';
  lines.forEach((l, i) => { c.font = fontFor(l); c.fillText(l.text, PAD_X, PAD_Y + SIZE * LINE * i + SIZE * 0.82); });
  return { url: canvas.toDataURL('image/png'), ratio: w / h };
}

const useStill = () => {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return still;
};

/**
 * Text drawn as liquid metal (Paper Shaders, the effect behind paper-design/liquid-logo).
 * The tint follows the mode accent. While the mask is being made the plain text shows in its place.
 * `height` is the height of the whole block, so font size is roughly height / lines * 0.42.
 */
export default function LiquidWord({ text, tint, height = 96, busy = false, maxWidth = 420 }: {
  text: string | Line[]; tint: string; height?: number; busy?: boolean; maxWidth?: number;
}) {
  const lines = asLines(text);
  const key = JSON.stringify(lines);
  const [mask, setMask] = useState<{ key: string; url: string; ratio: number } | null>(null);
  const still = useStill();

  useEffect(() => {
    let live = true;
    rasterise(JSON.parse(key) as Line[]).then((m) => { if (live) setMask({ key, ...m }); }, () => {});
    return () => { live = false; };
  }, [key]);

  const ready = mask?.key === key ? mask : null;
  const label = lines.map((l) => l.text).join(' ');
  return (
    <div role="img" aria-label={label} className="liquid-word" style={{ height }}>
      {ready ? (
        <div className="liquid-stack" style={{ height, width: Math.min(height * ready.ratio, maxWidth), maxWidth: '100%' }}>
          <div className="liquid-under" style={{ background: tint, WebkitMaskImage: `url(${ready.url})`, maskImage: `url(${ready.url})` }} />
          <LiquidMetal
            image={ready.url} fit="contain"
            colorBack="#00000000" colorTint={`${tint}b3`} scale={1}
            repetition={1.8} softness={0.8} contour={0.4} distortion={0.1} shiftRed={0.2} shiftBlue={0.3} angle={70}
            speed={still ? 0 : busy ? 1.6 : 0.45}
            style={{ height: '100%', width: '100%', mixBlendMode: 'screen' }}
          />
        </div>
      ) : (
        <span className="serif" aria-hidden="true" style={{ fontSize: (height / lines.length) * 0.42, lineHeight: 1.05, fontStyle: 'italic', color: tint }}>
          {lines.map((l, i) => <span key={i} style={{ display: 'block', fontStyle: l.italic ? 'italic' : 'normal' }}>{l.text}</span>)}
        </span>
      )}
    </div>
  );
}
