'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, type Mode } from '../api/client';
import { ACCENTS } from '../lib/anim';
import { useGo } from '../lib/nav';
import LiquidWord from './LiquidWord';
import NavLink from './NavLink';
import { useProviders } from '../state/useProviders';

const TABS: [Mode, string, string][] = [['tts', 'Text to Speech', 'TTS'], ['stt', 'Speech to Text', 'STT'], ['sts', 'Speech to Speech', 'STS']];

export default function Header({ mode }: { mode: Mode | null }) {
  const router = useRouter();
  const go = useGo();
  useEffect(() => { TABS.forEach(([m]) => router.prefetch(`/${m}`)); }, [router]);
  const idx = mode ? TABS.findIndex((x) => x[0] === mode) : 0;
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000, retry: false });
  const { data: providers } = useProviders();
  const held = providers.filter((p) => p.connected).length;
  return (
    <header className="header">
      <div className="brand">
        <span className="word"><LiquidWord text="Resonance" tint={ACCENTS[mode ?? 'tts']} height={44} maxWidth={200} /></span>
        <span className="mono lab">LAB</span>
      </div>
      <div role="tablist" aria-label="Mode" className={`modes${mode ? '' : ' none'}`}>
        <div aria-hidden="true" className="pill" style={{ transform: `translateX(${idx * 176}px)` }} />
        {TABS.map(([m, label, abbr]) => (
          <button key={m} role="tab" aria-selected={m === mode} className={`tab${m === mode ? ' on' : ''}`} onClick={() => go(`/${m}`)}>
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
          <NavLink href="/providers" className="keys-chip" title="Your API keys stay in this browser">
            <span className="dot" style={{ background: held ? 'var(--stt)' : 'var(--accent)' }} />
            {held ? `${held} of ${providers.length} keys added` : 'Add API keys'}
          </NavLink>
        )}
      </div>
    </header>
  );
}
