'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Mode } from '../api/types';

/** Lets a page that is not a playground tab borrow a mode's accent, so the aurora and orb follow it. */
let current: Mode | null = null;
const listeners = new Set<() => void>();
const set = (m: Mode | null) => { current = m; listeners.forEach((l) => l()); };

export const usePageMode = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current, () => null);

export function useBorrowMode(mode: Mode) {
  useEffect(() => {
    set(mode);
    return () => set(null);
  }, [mode]);
}
