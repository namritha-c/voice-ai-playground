import { useSyncExternalStore } from 'react';

/**
 * Bring-your-own-key store. The server holds no keys: each person's keys live only in their browser.
 * By default a key is kept for this tab (sessionStorage) and forgotten when it closes.
 * "Remember on this device" moves it to localStorage.
 */
export interface StoredKey { key: string; remember: boolean }
export type Keys = Record<string, StoredKey>;

const STORE = 'resonance.keys.v1';
const EMPTY: Keys = {};

let state: Keys | null = null;
const subs = new Set<() => void>();

function read(storage: () => Storage): Keys {
  try { return JSON.parse(storage().getItem(STORE) ?? '{}') as Keys; } catch { return {}; }
}

function load(): Keys {
  if (typeof window === 'undefined') return EMPTY;
  const local = read(() => localStorage), session = read(() => sessionStorage);
  const out: Keys = {};
  for (const [pid, v] of Object.entries(local)) if (v?.key) out[pid] = { key: v.key, remember: true };
  for (const [pid, v] of Object.entries(session)) if (v?.key) out[pid] = { key: v.key, remember: false }; // a newer tab-only key wins
  return out;
}

function persist(next: Keys) {
  for (const [kind, storage] of [[true, () => localStorage], [false, () => sessionStorage]] as const) {
    const part = Object.fromEntries(Object.entries(next).filter(([, v]) => v.remember === kind));
    try {
      if (Object.keys(part).length) storage().setItem(STORE, JSON.stringify(part));
      else storage().removeItem(STORE);
    } catch { /* storage blocked: the key still works for this page view */ }
  }
}

function set(next: Keys) {
  state = next;
  persist(next);
  subs.forEach((f) => f());
}

const snapshot = () => (state ??= load());

if (typeof window !== 'undefined') {
  // keep other tabs in step when a remembered key is added or removed
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE) return;
    state = load();
    subs.forEach((f) => f());
  });
}

export function useKeys(): Keys {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, snapshot, () => EMPTY);
}

export const keys = {
  get: (pid: string): string => snapshot()[pid]?.key ?? '',
  set: (pid: string, key: string, remember: boolean) => set({ ...snapshot(), [pid]: { key: key.trim(), remember } }),
  remove: (pid: string) => { const { [pid]: _gone, ...rest } = snapshot(); set(rest); },
};

/** `••••a3f9` — enough to recognise a key without showing it. */
export function maskKey(key: string): string {
  return key.length > 8 ? `••••${key.slice(-4)}` : '••••';
}
