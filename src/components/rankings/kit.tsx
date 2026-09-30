'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Metric, Try } from '../../data/rankings';
import { useGo } from '../../lib/nav';
import { actions } from '../../state/playground';
import { useProviders } from '../../state/useProviders';
import { IconArrowUpRight } from '../Icons';

export const stillNow = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts up to `value` when it mounts or changes. People who ask for less motion get the number at once. */
export function Num({ value, decimals = 0, ms = 1100, className }: { value: number; decimals?: number; ms?: number; className?: string }) {
  const [shown, setShown] = useState(() => (stillNow() ? value : 0));
  useEffect(() => {
    if (stillNow()) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setShown(value * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className={className}>{shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })}</span>;
}

/** Where `v` sits on the metric's scale, 0 to 1. */
export const along = (v: number, [a, b]: [number, number]) => Math.max(0, Math.min(1, (v - a) / (b - a)));

export const fmtMetric = (m: Metric, v: number) => `${v.toLocaleString('en-US', { minimumFractionDigits: m.decimals, maximumFractionDigits: m.decimals, useGrouping: false })}${m.unit}`;

export const ProviderTile = ({ name, size = 40 }: { name: string; size?: number }) => (
  <span className="mono-tile rk-tile" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.46 }}>{name.trim()[0]?.toUpperCase()}</span>
);

export const Warn = ({ children }: { children: ReactNode }) => (
  <p className="rk-flag">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4zM12 10v4.5M12 17.4v.1" /></svg>
    <span>{children}</span>
  </p>
);

export const Tag = ({ children }: { children: string }) => <span className={`rk-tag${/^(New|Added|Fastest|Fast)$/.test(children) ? ' hot' : ''}`}>{children}</span>;

/** Opens the row's provider in the playground. Hidden until this browser holds a key for it. */
export function TryPill({ to }: { to: Try }) {
  const go = useGo();
  const { data } = useProviders();
  const p = data.find((x) => x.id === to.pid);
  if (!p?.connected) return null;
  return (
    <button className="rk-try" onClick={() => {
      actions.provider(to.mode, to.pid);
      go(`/${to.mode}`);
    }}>
      Try in playground<IconArrowUpRight size={13} />
    </button>
  );
}

export function Callout({ tone, title, children }: { tone: 'warn' | 'note'; title: string; children: ReactNode }) {
  return (
    <div className={`rk-callout ${tone}`} role="note">
      <span className="rk-callout-k">{title}</span>
      <p>{children}</p>
    </div>
  );
}
