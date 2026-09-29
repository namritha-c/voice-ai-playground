import type { Mode } from '../../api/client';
import { ACCENTS, clamp, fvs } from '../../lib/anim';
import { spectrum } from '../../lib/audio';
import LiquidWord from '../LiquidWord';
import { OrbSlot } from './OrbHost';

const HEADLINES: Record<Mode, [string, string]> = { tts: ['Give words', 'a voice.'], stt: ['Hear every', 'word.'], sts: ['Speak in', 'any voice.'] };

export type Energy = 'idle' | 'busy' | 'live';

export function Headline({ mode }: { mode: Mode }) {
  const [top, bottom] = HEADLINES[mode];
  return (
    <h1 className="hl">
      <LiquidWord text={[{ text: top }, { text: bottom, italic: true }]} tint={ACCENTS[mode]} height={152} />
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

/** Ring bars have a fixed height and are scaled, so redrawing them each frame never needs layout. */
const BAR = 40;

export function Orb({ t, energy, progress, level, phaseLabel, title, sub, motion = 1 }: {
  t: number; energy: Energy; progress: number; level: number; phaseLabel: string; title: string; sub: string; motion?: number;
}) {
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
    bars.push(<div key={i} className="ob" style={{ height: BAR, transform: `rotate(${((a * 180) / Math.PI).toFixed(2)}deg) translateY(-122px) scaleY(${(h / BAR).toFixed(3)})`, opacity: (0.25 + 0.75 * Math.min(1, h / 46)).toFixed(2) }} />);
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
      <OrbSlot energy={energy} level={level} />
      <div className="breathe" aria-hidden="true">{bars}</div>
      <div role="status" aria-live="polite" className="orb-center">
        <div className="mono orb-phase">
          <span className={busy || active ? 'blink' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{phaseLabel}</span>
        </div>
        <div className="orb-title">
          <div className="serif ellipsis orb-title-plain" style={{ fontVariationSettings: fvs(360 + 380 * lvl, 72, 100, 1) }}>{title}</div>
        </div>
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
    </svg>
  );
}
