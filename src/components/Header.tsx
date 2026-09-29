'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type Mode } from '../api/client';
import { fvs } from '../lib/anim';
import { useProviders } from '../state/useProviders';

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
  const router = useRouter();
  const idx = mode ? TABS.findIndex((x) => x[0] === mode) : 0;
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000, retry: false });
  const { data: providers } = useProviders();
  const held = providers.filter((p) => p.connected).length;
  return (
    <header className="header">
      <div className="brand">
        <Wordmark t={t} level={level} />
        <span className="mono lab">LAB</span>
      </div>
      <div role="tablist" aria-label="Mode" className={`modes${mode ? '' : ' none'}`}>
        <div aria-hidden="true" className="pill" style={{ transform: `translateX(${idx * 176}px)` }} />
        {TABS.map(([m, label, abbr]) => (
          <button key={m} role="tab" aria-selected={m === mode} className={`tab${m === mode ? ' on' : ''}`} onClick={() => router.push(`/${m}`)}>
            <span>{label}</span><span className="abbr">{abbr}</span>
          </button>
        ))}
      </div>
      <div className="header-right">
        {health.isError ? (
          <span className="mono api-state" title="The server is not reachable">
            <span className="dot" style={{ background: 'var(--danger)' }} />API OFFLINE
          </span>
        ) : (
          <Link href="/providers" className="keys-chip" title="Your API keys stay in this browser">
            <span className="dot" style={{ background: held ? 'var(--stt)' : 'var(--accent)' }} />
            {held ? `${held} of ${providers.length} keys added` : 'Add API keys'}
          </Link>
        )}
      </div>
    </header>
  );
}
