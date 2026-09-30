'use client';

import { useState } from 'react';
import { MODES, type Mode } from '../api/client';
import { IconKey, IconSearch } from '../components/Icons';
import { useKeySheet } from '../components/KeySheet';
import { CAP_STYLE, fvs } from '../lib/anim';
import { useGo } from '../lib/nav';
import { useClock } from '../lib/useClock';
import { keys, maskKey } from '../state/keys';
import { actions } from '../state/playground';
import { useProviders } from '../state/useProviders';

const FILTERS: [Mode | 'all', string][] = [['all', 'All'], ['tts', 'Text to Speech'], ['stt', 'Speech to Text'], ['sts', 'Speech to Speech']];

export function PageTitle({ text, t }: { text: string; t: number }) {
  return (
    <h1 className="hl-big" aria-label={text}>
      <span className="hl-line" aria-hidden="true">
        {text.split('').map((c, k) => {
          const dot = c === '.';
          return <span key={k} className="ch" style={{
            animationDelay: `${(0.06 + k * 0.035).toFixed(3)}s`, fontStyle: dot ? 'italic' : 'normal', color: dot ? 'var(--tts)' : 'var(--ink)',
            fontVariationSettings: fvs(300 + 40 * Math.sin(t * 1.1 - k * 0.4), 144, 30, 0),
          }}>{c}</span>;
        })}
      </span>
    </h1>
  );
}

export function PageBackdrop() {
  return (
    <svg aria-hidden="true" width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: -1 }}>
      <defs><pattern id="pdots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#1F1D1A" /></pattern></defs>
      <rect width="100%" height="100%" fill="url(#pdots)" />
    </svg>
  );
}

export default function Providers() {
  const go = useGo();
  const t = useClock(20);
  const [f, setF] = useState<Mode | 'all'>('all');
  const [q, setQ] = useState('');
  const sheet = useKeySheet();
  const { data, isError, isLoading } = useProviders();
  const shown = data.filter((p) => (f === 'all' || p.caps.includes(f)) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const connected = data.filter((p) => p.connected).length;

  const open = (pid: string, caps: Mode[], connected: boolean) => {
    if (!connected) return sheet.open(pid);
    const m = f !== 'all' && caps.includes(f) ? f : caps[0];
    actions.provider(m, pid);
    go(`/${m}`);
  };

  return (
    <main className="page">
      <PageBackdrop />
      <div className="pv-head">
        <PageTitle text="Providers." t={t} />
        <div className="pv-count">
          <span className="serif" style={{ fontSize: 30, lineHeight: 1, fontStyle: 'italic', letterSpacing: '-0.02em', fontVariationSettings: "'opsz' 36, 'wght' 380, 'SOFT' 100, 'WONK' 1", fontVariantNumeric: 'lining-nums' }}>
            {connected}<span style={{ color: 'var(--mute-2)' }}> / {data.length}</span>
          </span>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--mute)' }}>KEYS ADDED</span>
        </div>
        <div className="pv-spacer" />
        <div className="pv-search">
          <label htmlFor="pq" className="sr">Search providers</label>
          <span style={{ position: 'absolute', left: 16, top: 15, color: 'var(--mute)', display: 'flex' }}><IconSearch /></span>
          <input id="pq" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers" />
        </div>
      </div>

      <div role="group" aria-label="Filter by capability" className="pv-chips">
        {FILTERS.map(([id, label]) => {
          const n = id === 'all' ? data.length : data.filter((p) => p.caps.includes(id)).length;
          return (
            <button key={id} className={`fchip${f === id ? ' on' : ''}`} aria-pressed={f === id} onClick={() => setF(id)}>
              {id !== 'all' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: CAP_STYLE[id][1] }} />}
              {label}<span className="mono" style={{ fontSize: 10, opacity: 0.55 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {isError && <p className="empty-state">Can’t reach the API. Reload to try again.</p>}
      {isLoading && <p className="empty-state">Loading providers…</p>}

      <div className="pgrid" style={{ position: 'relative' }}>
        {shown.map((p, i) => (
          <div key={p.id} className="card link" style={{ animationDelay: `${(0.35 + i * 0.06).toFixed(2)}s` }}>
            <button className="card-hit" onClick={() => open(p.id, p.caps, p.connected)}
              aria-label={p.connected ? `Open ${p.name} in the playground` : `Add your ${p.name} API key`} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span className="mono-tile" style={{ width: 46, height: 46, borderRadius: 13, fontSize: 20, color: p.connected ? 'var(--tts)' : 'var(--mute)' }}>{p.mono}</span>
              <button className={`card-key${p.connected ? ' on' : ''}`} onClick={() => sheet.open(p.id)}
                aria-label={p.connected ? `Manage your ${p.name} key` : `Add your ${p.name} key`}>
                {p.connected ? (
                  <>
                    <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
                      <span className="eq live" style={{ height: 9, background: 'var(--ink)' }} />
                      <span className="eq live" style={{ height: 14, animationDelay: '.15s', background: 'var(--ink)' }} />
                      <span className="eq live" style={{ height: 7, animationDelay: '.3s', background: 'var(--ink)' }} />
                    </span>
                    Key {maskKey(keys.get(p.id))}
                  </>
                ) : <><IconKey size={13} />Add key</>}
              </button>
            </div>
            <div className="nm" style={{ marginTop: 'auto' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, width: '100%' }}>
              {MODES.map((c) => {
                const on = p.caps.includes(c);
                return <span key={c} className="cap" style={{ border: `1px solid ${on ? CAP_STYLE[c][1] : 'var(--line-2)'}`, color: on ? CAP_STYLE[c][1] : 'var(--mute-3)', background: on ? CAP_STYLE[c][2] : 'transparent' }}>{CAP_STYLE[c][0]}</span>;
              })}
              <div style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--mute-2)' }}>{p.id}</span>
            </div>
          </div>
        ))}
        {!isLoading && !isError && (
          <div className="card add" style={{ animationDelay: `${(0.35 + shown.length * 0.06).toFixed(2)}s` }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--mute)' }}>ADD IN CODE</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>providers/&lt;id&gt;/manifest.json</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>providers/&lt;id&gt;/adapter.ts</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--mute-2)' }}>register in registry.ts</span>
            </div>
          </div>
        )}
      </div>
      {!isLoading && !isError && <p className="page-note">Your keys stay in this browser. Resonance’s server has none, and only forwards yours to the provider each request is for.</p>}
    </main>
  );
}
