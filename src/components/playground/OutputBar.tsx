import type { ReactNode } from 'react';
import { clamp } from '../../lib/anim';
import { IconCode, IconDownload } from '../Icons';

export interface Bar { h: number; fill: string; op: number }

export default function OutputBar({ playIcon, playLabel, onPlay, playDisabled, title, sub, bars, head, onSeek, time, metricK, metricV, onDownload, onCopy, copyFlash, canExport }: {
  playIcon: ReactNode; playLabel: string; onPlay: () => void; playDisabled?: boolean;
  title: string; sub: string; bars: Bar[]; head: number | null; onSeek?: (frac: number) => void;
  time: string; metricK: string; metricV: string | null;
  onDownload: () => void; onCopy: () => void; copyFlash: boolean; canExport: boolean;
}) {
  return (
    <section aria-label="Output" className="output">
      <button aria-label={playLabel} onClick={onPlay} className="play" disabled={playDisabled}>{playIcon}</button>
      <div className="out-meta">
        <div className="serif out-title ellipsis" title={title}>{title}</div>
        <div className="mono out-sub ellipsis">{sub}</div>
      </div>
      <div className="wave" onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(clamp((e.clientX - r.left) / r.width, 0, 1));
      }}>
        {bars.map((b, i) => <div key={i} className="wb" style={{ height: b.h.toFixed(1) + 'px', background: b.fill, opacity: b.op }} />)}
        {head !== null && <div aria-hidden="true" className="head" style={{ left: `${(head * 100).toFixed(2)}%`, opacity: 0.9 }} />}
      </div>
      <div className="mono time">{time}</div>
      <div className="metric">
        <span className="mono k">{metricK}</span>
        <span className="serif v">{metricV ?? '—'}{metricV && <span className="mono u">ms</span>}</span>
      </div>
      <button className="icon-btn" aria-label="Download" onClick={onDownload} disabled={!canExport}><IconDownload /></button>
      <button className={`icon-btn${copyFlash ? ' flash' : ''}`} aria-label="Copy API request" title="Copy API request (curl)" onClick={onCopy} disabled={!canExport}><IconCode /></button>
    </section>
  );
}
