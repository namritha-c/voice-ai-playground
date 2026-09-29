import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import type { Mode } from '../../api/client';
import { clamp, fvs, headlineWeights } from '../../lib/anim';
import { spectrum } from '../../lib/audio';
import type { OrbSignal } from './OrbGL';
import OrbCore from './OrbCore';

// three.js is only needed on the playground; load it on demand, in the browser.
const OrbGL = dynamic(() => import('./OrbGL'), { ssr: false });

const HEADLINES: Record<Mode, [string, string]> = { tts: ['Give words', 'a voice.'], stt: ['Hear every', 'word.'], sts: ['Speak in', 'any voice.'] };

export type Energy = 'idle' | 'busy' | 'live';

export function Headline({ mode, t, energy }: { mode: Mode; t: number; energy: Energy }) {
  const lines = headlineWeights(HEADLINES[mode], t, energy === 'live' ? 1 : energy === 'busy' ? 0.5 : 0);
  return (
    <h1 className="hl" aria-label={HEADLINES[mode].join(' ')}>
      {lines.map((chars, li) => (
        <span key={li} className="hl-line" aria-hidden="true" style={{ fontStyle: li === 1 ? 'italic' : 'normal', color: li === 1 ? 'var(--accent)' : 'var(--ink)' }}>
          {chars.map((c) => (
            <span key={c.k} className="ch" style={{ animationDelay: `${(0.08 + c.k * 0.032).toFixed(3)}s`, fontVariationSettings: c.fvs }}>{c.c === ' ' ? ' ' : c.c}</span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export function Chain({ rows, live, done }: { rows: string[]; live: boolean; done: boolean }) {
  return (
    <div className="chain">
      <svg aria-hidden="true" width="12" height="96" viewBox="0 0 12 96" style={{ position: 'absolute', left: 0, top: 16 }}>
        <line className={live ? 'flow fast' : 'flow'} x1="6" y1="0" x2="6" y2="96" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {rows.map((v, k) => (
        <div key={k} className="chain-row">
          <div className={`chain-dot${live ? ' node' : ''}`} style={{ background: live || done ? 'var(--accent)' : 'var(--bg)', animationDelay: `${(k * 0.3).toFixed(1)}s` }} />
          <div className="chain-val ellipsis" style={{ color: k === 1 ? 'var(--ink)' : 'var(--ink-4)' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export function Orb({ t, energy, progress, level, phaseLabel, title, sub, accent, motion = 1 }: {
  t: number; energy: Energy; progress: number; level: number; phaseLabel: string; title: string; sub: string; accent: string; motion?: number;
}) {
  const signal = useRef<OrbSignal>({ energy, level });
  useEffect(() => { signal.current = { energy, level }; });
  const busy = energy === 'busy', active = energy === 'live';
  const spec = active ? spectrum() : null;
  const N = 90;
  const bars = [];
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const base = 3 + 2.5 * (0.5 + 0.5 * Math.sin(i * 0.9 + t * 1.1));
    let h: number;
    if (busy) {
      const sw = (t * 3.4) % (Math.PI * 2);
      const d = Math.abs((((a - sw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      h = base + 50 * Math.exp(-d * d * 4);
    } else if (active && spec) {
      // mirror the low half of the spectrum around the ring so speech energy shows everywhere
      const bin = spec[Math.floor((i < N / 2 ? i : N - i) * 1.1) + 2] / 255;
      h = base + 52 * bin * (0.7 + 0.3 * Math.sin(t * 7.3 + i)) + 18 * level * Math.abs(Math.sin(i * 0.37 + t * 7.3));
    } else {
      h = base + 7 * Math.pow(Math.sin(t * 0.9 + i * 0.14), 2);
    }
    h = Math.max(2, h * motion);
    sum += h;
    bars.push(<div key={i} className="ob" style={{ height: h.toFixed(1) + 'px', transform: `rotate(${((a * 180) / Math.PI).toFixed(2)}deg) translateY(-122px)`, opacity: (0.25 + 0.75 * Math.min(1, h / 46)).toFixed(2) }} />);
  }
  const lvl = clamp((sum / N - 5) / 18, 0, 1);
  return (
    <div className="orb">
      <svg aria-hidden="true" viewBox="-200 -200 400 400" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="orbcore" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0C0B0A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="168" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1055.6"
          strokeDashoffset={(1055.6 * (1 - progress)).toFixed(1)} transform="rotate(-90)" />
        <g className="spin fast" opacity={busy ? 1 : 0}><circle r="168" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="90 966" /></g>
        <circle r="118" fill="url(#orbcore)" />
      </svg>
      <OrbCore accent={accent} energy={energy} />
      <OrbGL signal={signal} color={accent} />
      <div className="breathe" aria-hidden="true">{bars}</div>
      <div role="status" aria-live="polite" className="orb-center">
        <div className="mono orb-phase">
          <span className={busy || active ? 'blink' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{phaseLabel}</span>
        </div>
        <div className="serif orb-title ellipsis" style={{ fontVariationSettings: fvs(360 + 380 * lvl, 72, 100, 1) }}>{title}</div>
        <div className="mono orb-sub">{sub}</div>
      </div>
    </div>
  );
}

export function Backdrop() {
  return (
    <svg aria-hidden="true" width="100%" height="100%" className="backdrop">
      <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#26231F" /></pattern></defs>
      <rect width="100%" height="100%" fill="url(#dots)" />
      <g className="drift" fill="none" stroke="#1E1C19" strokeWidth="1">
        <path d="M-40 120 C 200 60, 420 200, 700 140 S 1100 60, 1180 160 S 1500 260, 1900 140 S 2400 70, 2800 200" />
        <path d="M-40 170 C 220 110, 440 250, 720 190 S 1100 110, 1180 210 S 1500 310, 1900 190 S 2400 120, 2800 250" />
        <path d="M-40 220 C 240 160, 460 300, 740 240 S 1100 160, 1180 260 S 1500 360, 1900 240 S 2400 170, 2800 300" />
        <path d="M-40 270 C 260 210, 480 350, 760 290 S 1100 210, 1180 310 S 1500 410, 1900 290 S 2400 220, 2800 350" />
      </g>
      <g className="drift d2" fill="none" stroke="#1B1916" strokeWidth="1">
        <path d="M-40 620 C 180 700, 460 560, 720 640 S 1060 720, 1180 620 S 1500 720, 1900 600 S 2400 530, 2800 660" />
        <path d="M-40 670 C 200 750, 480 610, 740 690 S 1060 770, 1180 670 S 1500 770, 1900 650 S 2400 580, 2800 710" />
        <path d="M-40 720 C 220 800, 500 660, 760 740 S 1060 820, 1180 720 S 1500 820, 1900 700 S 2400 630, 2800 760" />
      </g>
    </svg>
  );
}
