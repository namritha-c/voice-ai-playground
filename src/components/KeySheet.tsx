'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Provider } from '../api/client';
import { keys, maskKey, useKeys } from '../state/keys';
import { useProviders } from '../state/useProviders';
import { IconArrowUpRight, IconClose } from './Icons';
import { useToast } from './Toast';

const Ctx = createContext<{ open: (pid: string, reason?: string) => void }>({ open: () => undefined });
/** Open the "add your key" sheet for a provider from anywhere in the app. */
export const useKeySheet = () => useContext(Ctx);

export function KeySheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ pid: string; reason?: string } | null>(null);
  const { data } = useProviders();
  const api = useMemo(() => ({ open: (pid: string, reason?: string) => setTarget({ pid, reason }) }), []);
  const provider = data.find((p) => p.id === target?.pid);
  return (
    <Ctx.Provider value={api}>
      {children}
      {provider && <Sheet key={provider.id} provider={provider} reason={target?.reason} onClose={() => setTarget(null)} />}
    </Ctx.Provider>
  );
}

function Sheet({ provider, reason, onClose }: { provider: Provider; reason?: string; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const held = useKeys()[provider.id];
  const [value, setValue] = useState('');
  const [shown, setShown] = useState(false);
  const [remember, setRemember] = useState(held?.remember ?? false);

  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
    input.current?.focus(); // showModal() focuses the first control (Close); the key field is what people want
  }, []);

  const typed = value.trim();
  const moved = !!held && remember !== held.remember;
  const canSave = typed.length > 0 || moved;

  const save = useCallback(() => {
    const key = typed || held?.key;
    if (!key) return;
    keys.set(provider.id, key, remember);
    toast.info(`${provider.name} key saved${remember ? ' on this device' : ' for this tab'}.`);
    onClose();
  }, [typed, held, provider, remember, toast, onClose]);

  const remove = () => {
    keys.remove(provider.id);
    toast.info(`${provider.name} key removed.`);
    onClose();
  };

  return (
    <dialog ref={dlg} className="sheet" aria-labelledby="sheet-title" onClose={onClose}
      onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <form onSubmit={(e) => { e.preventDefault(); if (canSave) save(); }}>
        <div className="sheet-head">
          <span className="mono-tile" style={{ width: 44, height: 44, fontSize: 19, color: 'var(--accent)' }}>{provider.mono}</span>
          <h2 id="sheet-title" className="serif sheet-title">{held ? `${provider.name} key` : `Add your ${provider.name} key`}</h2>
          <button type="button" className="icon-btn sm" aria-label="Close" onClick={() => dlg.current?.close()}><IconClose /></button>
        </div>

        {reason && <p className="sheet-note" role="alert">{reason}</p>}
        <p className="sheet-copy">
          Resonance has no keys of its own. Your key stays in this browser and travels with each request so the server can call {provider.name} for you.
          The server never stores or logs it.
        </p>

        <label htmlFor="api-key" className="lbl">API key</label>
        <div className="keyfield">
          <input ref={input} id="api-key" className="key-input" type={shown ? 'text' : 'password'} value={value}
            onChange={(e) => setValue(e.target.value)} placeholder={held ? `Saved · ${maskKey(held.key)}. Paste a new key to replace it.` : 'Paste your key'}
            autoComplete="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" />
          <button type="button" className="mini-btn" onClick={() => setShown(!shown)} aria-pressed={shown}>{shown ? 'Hide' : 'Show'}</button>
        </div>
        <a className="sheet-link" href={provider.key_url} target="_blank" rel="noopener noreferrer">
          Get a key from {provider.name}<IconArrowUpRight size={13} />
        </a>

        <div className="sheet-row">
          <div>
            <div className="plabel">Remember on this device</div>
            <div className="sheet-hint">{remember ? 'Kept in this browser until you remove it.' : 'Forgotten when you close this tab.'}</div>
          </div>
          <button type="button" role="switch" aria-checked={remember} aria-label="Remember on this device" className={`sw${remember ? ' on' : ''}`} onClick={() => setRemember(!remember)}><span /></button>
        </div>

        <div className="sheet-actions">
          {held && <button type="button" className="mini-btn danger" onClick={remove}>Remove key</button>}
          <span style={{ flexGrow: 1 }} />
          <button type="button" className="sheet-btn" onClick={() => dlg.current?.close()}>Cancel</button>
          <button type="submit" className="sheet-btn primary" disabled={!canSave}>Save key</button>
        </div>
      </form>
    </dialog>
  );
}
