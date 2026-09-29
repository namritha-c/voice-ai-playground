import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Mode } from '../api/client';
import { fvs } from '../lib/anim';

const TABS: [Mode, string, string][] = [['tts', 'Text to Speech', 'TTS'], ['stt', 'Speech to Text', 'STT'], ['sts', 'Speech to Speech', 'STS']];

export function Wordmark({ t, level = 0, motion = 1 }: { t: number; level?: number; motion?: number }) {
  return (
    <span className="serif word" aria-label="Resonance">
      {'Resonance'.split('').map((c, k) => (
        <span key={k} className="wm" aria-hidden="true" style={{
          animationDelay: `${(0.05 + k * 0.045).toFixed(3)}s`,
          fontVariationSettings: fvs(430 + 70 * motion * Math.sin(t * 0.8 - k * 0.5) + 200 * level * Math.max(0, Math.sin(t * 6 - k * 0.7)), 36, 100, 1),
        }}>{c}</span>
      ))}
    </span>
  );
}

export default function Header({ mode, t, level }: { mode: Mode | null; t: number; level?: number }) {
  const nav = useNavigate();
  const idx = mode ? TABS.findIndex((x) => x[0] === mode) : 0;
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000, retry: false });
  const up = health.isSuccess;
  return (
    <header className="header">
      <div className="brand">
        <Wordmark t={t} level={level} />
        <span className="mono lab">LAB</span>
      </div>
      <div role="tablist" aria-label="Mode" className={`modes${mode ? '' : ' none'}`}>
        <div aria-hidden="true" className="pill" style={{ left: 4 + idx * 176 }} />
        {TABS.map(([m, label, abbr]) => (
          <button key={m} role="tab" aria-selected={m === mode} className={`tab${m === mode ? ' on' : ''}`} onClick={() => nav(`/${m}`)}>
            <span>{label}</span><span className="abbr">{abbr}</span>
          </button>
        ))}
      </div>
      <div className="header-right">
        <span className="mono api-state" title={up ? 'Backend reachable' : 'Backend not reachable — start resonance-api'}>
          <span className="dot" style={{ background: up ? 'var(--stt)' : health.isLoading ? 'var(--mute)' : 'var(--danger)' }} />
          {up ? 'API ONLINE' : health.isLoading ? 'CONNECTING' : 'API OFFLINE'}
        </span>
      </div>
    </header>
  );
}
