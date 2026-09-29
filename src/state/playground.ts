import { useSyncExternalStore } from 'react';
import type { Mode } from '../api/client';

/** What the user picked, per mode and per provider. Persisted per browser as a convenience. */
export interface Selection {
  provider: Partial<Record<Mode, string>>;
  model: Record<string, string>; // `${mode}:${pid}`
  voice: Record<string, { id: string; name: string }>; // `${mode}:${pid}`
  params: Record<string, Record<string, unknown>>; // `${mode}:${pid}`
  text: string;
}

const KEY = 'resonance.selection.v1';
const DEFAULT: Selection = {
  provider: {},
  model: {},
  voice: {},
  params: {},
  text: 'Welcome to the voice lab. Pick a provider and a voice, then press Generate to hear this come alive.',
};

function load(): Selection {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return DEFAULT;
}

let state = load();
const subs = new Set<() => void>();
let saveTimer = 0;

export function update(fn: (s: Selection) => Selection) {
  state = fn(state);
  subs.forEach((f) => f());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, 250);
}

export function useSelection(): Selection {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);
}

export const k = (mode: Mode, pid: string) => `${mode}:${pid}`;

export const actions = {
  provider: (mode: Mode, pid: string) => update((s) => ({ ...s, provider: { ...s.provider, [mode]: pid } })),
  model: (mode: Mode, pid: string, model: string) => update((s) => ({ ...s, model: { ...s.model, [k(mode, pid)]: model } })),
  voice: (mode: Mode, pid: string, v: { id: string; name: string }) => update((s) => ({ ...s, voice: { ...s.voice, [k(mode, pid)]: v } })),
  param: (mode: Mode, pid: string, key: string, val: unknown) =>
    update((s) => ({ ...s, params: { ...s.params, [k(mode, pid)]: { ...s.params[k(mode, pid)], [key]: val } } })),
  resetParams: (mode: Mode, pid: string) => update((s) => ({ ...s, params: { ...s.params, [k(mode, pid)]: {} } })),
  text: (text: string) => update((s) => ({ ...s, text })),
};
