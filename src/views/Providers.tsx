import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, MODES, type Mode } from '../api/client';
import { IconSearch } from '../components/Icons';
import { CAP_STYLE, fvs } from '../lib/anim';
import { actions } from '../state/playground';

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
    <svg aria-hidden="true" width="1364" height="1024" viewBox="0 0 1364 1024" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <defs><pattern id="pdots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#1F1D1A" /></pattern></defs>
      <rect width="1364" height="1024" fill="url(#pdots)" />
      <g className="drift" fill="none" stroke="#1B1916" strokeWidth="1">
        <path d="M-40 160 C 260 80, 520 240, 860 170 S 1300 90, 1420 190" />
        <path d="M-40 210 C 280 130, 540 290, 880 220 S 1300 140, 1420 240" />
        <path d="M-40 260 C 300 180, 560 340, 900 270 S 1300 190, 1420 290" />
      </g>
    </svg>
  );
}

export default function Providers({ t }: { t: number }) {
  const nav = useNavigate();
  const [f, setF] = useState<Mode | 'all'>('all');
  const [q, setQ] = useState('');
  const { data = [], isError, isLoading } = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const shown = data.filter((p) => (f === 'all' || p.caps.includes(f)) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const connected = data.filter((p) => p.connected).length;

  const open = (pid: string, caps: Mode[]) => {
    const m = f !== 'all' && caps.includes(f) ? f : caps[0];
    actions.provider(m, pid);
    nav(`/${m}`);
  };

  return (
    <main className="page">
      <PageBackdrop />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
        <PageTitle text="Providers." t={t} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
          <span className="serif" style={{ fontSize: 30, lineHeight: 1, fontStyle: 'italic', letterSpacing: '-0.02em', fontVariationSettings: "'opsz' 36, 'wght' 380, 'SOFT' 100, 'WONK' 1", fontVariantNumeric: 'lining-nums' }}>
            {connected}<span style={{ color: 'var(--mute-2)' }}> / {data.length}</span>
          </span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--mute)' }}>CONNECTED</span>
        </div>
        <div style={{ flexGrow: 1 }} />
        <div style={{ position: 'relative', width: 280, paddingBottom: 12 }}>
          <label htmlFor="pq" className="sr">Search providers</label>
          <span style={{ position: 'absolute', left: 16, top: 15, color: 'var(--mute)', display: 'flex' }}><IconSearch /></span>
          <input id="pq" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers" />
        </div>
      </div>

      <div role="group" aria-label="Filter by capability" style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 30 }}>
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

      {isError && <p className="empty-state">Backend offline — start resonance-api on :8000.</p>}
      {isLoading && <p className="empty-state">Loading providers…</p>}

      <div className="pgrid" style={{ position: 'relative' }}>
        {shown.map((p, i) => (
          <button key={p.id} className="card" style={{ animationDelay: `${(0.35 + i * 0.06).toFixed(2)}s` }} onClick={() => open(p.id, p.caps)}
            aria-label={`${p.name}, ${p.connected ? 'connected' : 'no API key set'}, supports ${p.caps.join(', ').toUpperCase()}`}
            title={p.connected ? `Open ${p.name} in the playground` : `Add ${p.missing_env.join(', ')} to resonance-api/.env`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span className="mono-tile" style={{ width: 46, height: 46, borderRadius: 13, fontSize: 20, color: p.connected ? 'var(--tts)' : 'var(--mute)' }}>{p.mono}</span>
              <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.18em', color: p.connected ? 'var(--ink)' : 'var(--mute)' }}>
                {p.connected ? (
                  <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
                    <span className="eq live" style={{ height: 9, background: 'var(--ink)' }} />
                    <span className="eq live" style={{ height: 14, animationDelay: '.15s', background: 'var(--ink)' }} />
                    <span className="eq live" style={{ height: 7, animationDelay: '.3s', background: 'var(--ink)' }} />
                  </span>
                ) : <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--mute-2)' }} />}
                {p.connected ? 'CONNECTED' : 'NO KEY'}
              </span>
            </div>
            <div className="nm" style={{ marginTop: 'auto' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, width: '100%' }}>
              {MODES.map((c) => {
                const on = p.caps.includes(c);
                return <span key={c} className="cap" style={{ border: `1px solid ${on ? CAP_STYLE[c][1] : 'var(--line-2)'}`, color: on ? CAP_STYLE[c][1] : 'var(--mute-3)', background: on ? CAP_STYLE[c][2] : 'transparent' }}>{CAP_STYLE[c][0]}</span>;
              })}
              <div style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.04em', color: 'var(--mute-2)' }}>{p.id}</span>
            </div>
          </button>
        ))}
        {!isLoading && !isError && (
          <div className="card add" style={{ animationDelay: `${(0.35 + shown.length * 0.06).toFixed(2)}s` }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--mute)' }}>ADD IN CODE</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>providers/&lt;id&gt;/manifest.json</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>providers/&lt;id&gt;/adapter.py</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--mute-2)' }}>.env → restart</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
