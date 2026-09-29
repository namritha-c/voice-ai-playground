'use client';

import dynamic from 'next/dynamic';
import { Component, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Energy } from './Hero';
import type { OrbSignal } from './OrbGL';

const OrbGL = dynamic(() => import('./OrbGL'), { ssr: false });

/**
 * The orb's WebGL canvases live here, in the app shell, for the whole session. Each tab is its own page,
 * so a canvas inside the page would lose its WebGL context and recompile its shaders on every switch.
 * Instead the page renders an `OrbSlot`, and the one host node moves into whichever slot is mounted.
 */
const signal: { current: OrbSignal } = { current: { energy: 'idle', level: 0 } };
let state: { slot: HTMLElement | null } = { slot: null };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const set = (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export function OrbSlot({ energy, level }: { energy: Energy; level: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { signal.current = { energy, level }; });
  useLayoutEffect(() => {
    const el = ref.current;
    set({ slot: el });
    return () => { if (state.slot === el) set({ slot: null }); };
  }, []);
  return <div ref={ref} aria-hidden="true" />;
}

export function OrbHost({ accent }: { accent: string }) {
  const [host] = useState(() => Object.assign(document.createElement('div'), { className: 'orb-host' }));
  const park = useRef<HTMLDivElement>(null);
  const { slot } = useSyncExternalStore(subscribe, () => state);
  const [used, setUsed] = useState(false);
  if (slot && !used) setUsed(true); // three.js loads on the first visit to a playground, not before

  // Parked, the node stays inside .app so its colour variables still resolve when it moves back.
  useLayoutEffect(() => { (slot ?? park.current)?.appendChild(host); }, [slot, host]);

  return (
    <>
      <div ref={park} hidden />
      {used && createPortal(
        <NoWebGL>
          <OrbGL signal={signal} color={accent} paused={!slot} />
        </NoWebGL>,
        host,
      )}
    </>
  );
}

/** Without WebGL the canvases throw while mounting. The page stays usable without them. */
export class NoWebGL extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
