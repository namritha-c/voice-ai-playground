import { useState } from 'react';
import type { Voice } from '../../api/client';
import { hash } from '../../lib/anim';
import { IconPlay, IconStop } from '../Icons';

export default function VoiceGrid({ voices, selected, onPick, onPreview, previewing, loading }: {
  voices: Voice[]; selected: Voice | undefined; onPick: (v: Voice) => void; onPreview: (v: Voice) => void;
  previewing: string | null; loading: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const shown = q ? voices.filter((v) => `${v.name} ${v.desc ?? ''} ${v.id}`.toLowerCase().includes(q.toLowerCase())) : voices;
  const copy = () => {
    if (!selected) return;
    navigator.clipboard?.writeText(selected.id).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="field">
      <span className="lbl">Voice{loading ? ' · loading…' : voices.length > 6 ? ` · ${voices.length}` : ''}</span>
      <div className="vid">
        <span className="mono ellipsis" style={{ flexGrow: 1, fontSize: 11.5, letterSpacing: '0.03em', color: 'var(--ink-2)' }}>{selected?.id ?? '—'}</span>
        <button onClick={copy} aria-label="Copy voice ID" className="mini-btn">{copied ? 'COPIED' : 'COPY'}</button>
      </div>
      {voices.length > 8 && (
        <input className="vsearch" placeholder="Filter voices" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter voices" />
      )}
      <div className="vgrid">
        {shown.map((v) => {
          const sel = v.id === selected?.id, hv = hash(v.id), busy = previewing === v.id;
          return (
            <div key={v.id} style={{ position: 'relative' }}>
              <button className={`vcard${sel ? ' on' : ''}`} aria-pressed={sel} onClick={() => onPick(v)}>
                <div className="vglyph">
                  {[0, 1, 2, 3, 4].map((g) => (
                    <div key={g} className={`eq${sel || busy ? ' live' : ''}`}
                      style={{ height: 6 + ((hv >> (g * 4)) & 15), animationDelay: `${(g * 0.11).toFixed(2)}s`, background: sel ? 'var(--accent)' : 'var(--mute-2)' }} />
                  ))}
                </div>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="vn ellipsis">{v.name}</span>
                  <span className="vd ellipsis">{v.desc || v.id}</span>
                </div>
              </button>
              <button className={`prev${busy ? ' busy' : ''}`} aria-label={`${busy ? 'Stop preview' : 'Preview'} ${v.name}`} onClick={() => onPreview(v)}>
                {busy ? <IconStop size={9} /> : <IconPlay size={10} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
