'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Mode, Provider } from '../../api/client';
import { IconArrowUpRight, IconChevron } from '../Icons';

export default function ProviderPicker({ mode, providers, current, onPick }: {
  mode: Mode; providers: Provider[]; current: Provider | undefined; onPick: (p: Provider) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const tag = (p: Provider) => p.modes[mode]?.tag ?? '';

  return (
    <div ref={ref} className="field" style={{ position: 'relative', zIndex: 5 }}>
      <span className="lbl">Provider</span>
      <button aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className={`prov-btn${open ? ' open' : ''}`}>
        <div className="mono-tile" style={{ width: 44, height: 44, fontSize: 19, color: 'var(--accent)' }}>{current?.mono ?? '··'}</div>
        <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="serif ellipsis" style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.015em', fontVariationSettings: "'opsz' 36, 'wght' 420" }}>{current?.name ?? 'Loading…'}</span>
          <span className="mono ellipsis" style={{ fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--mute)' }}>
            {current ? (current.connected ? tag(current) : 'No key yet · add one to use it') : ''}
          </span>
        </div>
        <span style={{ color: 'var(--ink-3)', transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .3s', display: 'flex' }}><IconChevron /></span>
      </button>
      {open && (
        <div className="pop menu prov-pop" role="listbox" aria-label="Providers">
          {providers.map((p) => {
            const sel = p.id === current?.id;
            return (
              <button key={p.id} role="option" aria-selected={sel} className={`pitem${sel ? ' on' : ''}${p.connected ? '' : ' off'}`}
                onClick={() => { onPick(p); setOpen(false); }}>
                <div className="mono-tile" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 16, color: sel ? 'var(--accent)' : 'var(--ink-3)' }}>{p.mono}</div>
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span className="pn">{p.name}</span>
                  <span className="mono ellipsis" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--mute)' }}>{tag(p)}</span>
                </div>
                {!p.connected && <span className="nokey">ADD KEY</span>}
              </button>
            );
          })}
          <div style={{ height: 1, background: 'var(--line-2)', margin: '4px 8px' }} />
          <Link className="pitem" href="/providers" style={{ height: 44, color: 'var(--ink-3)' }}>
            <span style={{ marginLeft: 10, display: 'flex' }}><IconArrowUpRight /></span>
            <span style={{ fontSize: 13 }}>All providers</span>
          </Link>
        </div>
      )}
    </div>
  );
}
