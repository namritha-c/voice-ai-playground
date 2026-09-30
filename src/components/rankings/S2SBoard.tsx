'use client';

import { useMemo, useState } from 'react';
import type { S2SBoard as Board, S2SEntry } from '../../data/rankings';
import { Callout, Num, ProviderTile, Tag, along } from './kit';

/** One colour per vendor, all from the app palette. */
const VENDOR: Record<string, string> = {
  Google: '#B9A2FF', OpenAI: '#F2EDE4', SpaceXAI: '#FF6A2B', 'Alibaba Cloud': '#A6E35A', StepFun: '#8F887D', Amazon: '#8F887D',
};

const W = 680, H = 372, L = 52, R = 22, T = 22, B = 50;
const XD: [number, number] = [0.6, 1.7];
const YD: [number, number] = [62, 86];
const px = (t: number) => L + along(t, XD) * (W - L - R);
const py = (v: number) => H - B - along(v, YD) * (H - T - B);

type Plotted = S2SEntry & { index: number; ttfa: number };
const plottable = (e: S2SEntry): e is Plotted => e.index !== null && e.ttfa !== null;

/** Points nobody beats on both axes: no other model is faster and scores higher. Walks fastest to slowest. */
function frontier(pts: Plotted[]): Plotted[] {
  const out: Plotted[] = [];
  let best = -Infinity;
  for (const p of [...pts].sort((a, b) => a.ttfa - b.ttfa)) if (p.index > best) { out.push(p); best = p.index; }
  return out;
}

function Scatter({ pts, sel, onSel }: { pts: Plotted[]; sel: S2SEntry; onSel: (e: S2SEntry) => void }) {
  const edge = useMemo(() => frontier(pts), [pts]);
  const d = edge.map((p, i) => `${i ? 'L' : 'M'}${px(p.ttfa).toFixed(1)} ${py(p.index).toFixed(1)}`).join(' ');
  const xs = [0.8, 1.0, 1.2, 1.4, 1.6];
  const ys = [65, 70, 75, 80, 85];
  const on = plottable(sel) ? sel : null;
  return (
    <svg className="rk-scatter" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Speech to speech models, speed against index score">
      {ys.map((y) => (
        <g key={y}>
          <line x1={L} x2={W - R} y1={py(y)} y2={py(y)} className="rk-grid" />
          <text x={L - 10} y={py(y) + 4} textAnchor="end" className="rk-tick">{y}</text>
        </g>
      ))}
      {xs.map((x) => (
        <g key={x}>
          <line y1={T} y2={H - B} x1={px(x)} x2={px(x)} className="rk-grid v" />
          <text x={px(x)} y={H - B + 20} textAnchor="middle" className="rk-tick">{x.toFixed(1)} s</text>
        </g>
      ))}
      <text x={L} y={H - 8} className="rk-axis-label">← faster to first audio</text>
      <text x={14} y={T + 4} className="rk-axis-label" transform={`rotate(-90 14 ${T + 4})`} textAnchor="end">index score →</text>
      <text x={W - R} y={T + 12} textAnchor="end" className="rk-corner">↖ faster and better</text>

      <path d={d} pathLength={1} className="rk-edge" />
      <text x={px(edge[0].ttfa) + 12} y={py(edge[0].index) - 12} className="rk-edge-label">Best trade-offs</text>

      {pts.map((p) => {
        const c = VENDOR[p.provider] ?? '#8F887D';
        const active = on?.model === p.model;
        return (
          <g key={p.model} className={`rk-dot${active ? ' on' : ''}`} tabIndex={0} role="button" aria-label={`${p.model}, index ${p.index}, ${p.ttfa} seconds`} aria-pressed={active}
            style={{ '--c': c, '--x': `${px(p.ttfa)}px`, '--y': `${py(p.index)}px`, '--d': `${0.2 + pts.indexOf(p) * 0.06}s` } as React.CSSProperties}
            onMouseEnter={() => onSel(p)} onFocus={() => onSel(p)} onClick={() => onSel(p)}>
            <circle className="halo" r={16} />
            <circle className="core" r={active ? 9 : 6.5} />
          </g>
        );
      })}
      {on && (
        <text x={px(on.ttfa)} y={py(on.index) - 20} textAnchor={px(on.ttfa) > W - 170 ? 'end' : 'middle'} className="rk-pin">{on.short}</text>
      )}
    </svg>
  );
}

function Meter({ label, v, unit = '%', fill, best }: { label: string; v: number | null; unit?: string; fill: number; best?: boolean }) {
  return (
    <div className={`rk-m${best ? ' best' : ''}`}>
      <div className="rk-m-top"><span>{label}</span><span className="mono">{v === null ? '–' : `${v}${unit}`}</span></div>
      <div className="rk-m-bar"><i key={`${label}-${v}`} style={{ '--w': v === null ? 0 : fill } as React.CSSProperties} /></div>
    </div>
  );
}

function Detail({ e, lead }: { e: S2SEntry; lead: Leaders }) {
  return (
    <div className="rk-panel rk-detail">
      <div className="rk-detail-head">
        <ProviderTile name={e.provider} size={44} />
        <div style={{ minWidth: 0 }}>
          <div className="rk-detail-name serif">{e.model}</div>
          <div className="rk-by"><span>{e.provider}</span>{e.tag && <Tag>{e.tag}</Tag>}</div>
        </div>
      </div>
      <div className="rk-detail-idx">
        {e.index === null ? <span className="rk-unranked serif">Not ranked</span> : <span className="serif"><Num key={e.model} value={e.index} decimals={1} /></span>}
        <span className="mono rk-k">{e.index === null ? 'no index score' : `index · rank ${e.rank ?? 'unlisted'}`}</span>
      </div>
      <Meter label="Reasoning" v={e.reasoning} fill={e.reasoning / 100} best={e.reasoning === lead.reasoning} />
      <Meter label="Full-duplex" v={e.duplex} fill={(e.duplex ?? 0) / 100} best={e.duplex === lead.duplex} />
      <Meter label="Speed" v={e.ttfa} unit=" s" fill={e.ttfa === null ? 0 : 1 - along(e.ttfa, XD)} best={e.ttfa === lead.ttfa} />
      <p className="rk-hint">Speed is time to first audio. A longer bar means a faster reply.</p>
    </div>
  );
}

interface Leaders { index: number; reasoning: number; duplex: number; ttfa: number }

function Donut({ parts, outside }: { parts: string[]; outside: string }) {
  const R0 = 46, C = 2 * Math.PI * R0, gap = 5;
  const seg = C / parts.length;
  return (
    <div className="rk-donut-wrap">
      <svg viewBox="0 0 120 120" className="rk-donut" role="img" aria-label="The index is four equal parts">
        {parts.map((p, i) => (
          <circle key={p} r={R0} cx={60} cy={60} pathLength={C} strokeDasharray={`${seg - gap} ${C - seg + gap}`} strokeDashoffset={-i * seg}
            style={{ '--d': `${0.1 + i * 0.14}s`, '--o': 0.35 + i * 0.2 } as React.CSSProperties} transform="rotate(-90 60 60)" />
        ))}
        <text x={60} y={58} textAnchor="middle" className="serif rk-donut-n">25%</text>
        <text x={60} y={74} textAnchor="middle" className="rk-donut-s">each</text>
      </svg>
      <ul className="rk-donut-list">
        {parts.map((p, i) => <li key={p}><i style={{ opacity: 0.35 + i * 0.2 }} />{p}</li>)}
        <li className="out"><i />{outside}</li>
      </ul>
    </div>
  );
}

export default function S2SBoard({ board }: { board: Board }) {
  const [sel, setSel] = useState<S2SEntry>(board.entries[0]);
  const pts = useMemo(() => board.entries.filter(plottable), [board.entries]);
  const lead: Leaders = useMemo(() => ({
    index: Math.max(...pts.map((p) => p.index)),
    reasoning: Math.max(...board.entries.map((e) => e.reasoning)),
    duplex: Math.max(...board.entries.map((e) => e.duplex ?? 0)),
    ttfa: Math.min(...pts.map((p) => p.ttfa)),
  }), [board.entries, pts]);
  return (
    <>
      <div className="rk-lead solo">
        <div className="rk-read">
          <p className="rk-takeaway serif">{board.takeaway}</p>
        </div>
      </div>

      <div className="rk-s2s-top">
        <div className="rk-panel rk-plot">
          <div className="rk-board-head">
            <div><span className="rk-k mono">Speed against quality</span><span className="rk-scale">Artificial Analysis S2S index</span></div>
            <div className="rk-vendors">{Object.entries(VENDOR).filter(([v]) => pts.some((p) => p.provider === v)).map(([v, c]) => <span key={v}><i style={{ background: c }} />{v}</span>)}</div>
          </div>
          <Scatter pts={pts} sel={sel} onSel={setSel} />
        </div>
        <Detail e={sel} lead={lead} />
      </div>

      <div className="rk-panel rk-board">
        <div className="rk-board-head">
          <div><span className="rk-k mono">Index ranking</span><span className="rk-scale">Pick a row to inspect it</span></div>
          <span className="rk-dir mono">accent = best in column</span>
        </div>
        <div className="rk-s2s-cols mono" aria-hidden="true">
          <span>Rank</span><span>Model</span><span>Index</span><span>Reasoning</span><span>Full-duplex</span><span>Time to audio</span>
        </div>
        <div className="rk-rows" role="list">
          {board.entries.map((e, i) => (
            <button key={e.model} role="listitem" className={`rk-row s2s${sel.model === e.model ? ' sel' : ''}${e.rank !== null && e.rank <= 3 ? ' top' : ''}`}
              style={{ '--i': i } as React.CSSProperties} onClick={() => setSel(e)} aria-pressed={sel.model === e.model}>
              <span className="rk-rank serif">{e.rank ?? '–'}</span>
              <span className="rk-who-head">
                <ProviderTile name={e.provider} size={34} />
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="rk-name">{e.model}</span>
                  <span className="rk-by"><span>{e.provider}</span>{e.tag && <Tag>{e.tag}</Tag>}</span>
                </span>
              </span>
              <span className={`rk-cell mono${e.index === lead.index ? ' best' : ''}`}>{e.index === null ? 'Not ranked' : e.index.toFixed(1)}</span>
              <span className={`rk-cell mono${e.reasoning === lead.reasoning ? ' best' : ''}`}><em style={{ '--w': e.reasoning / 100 } as React.CSSProperties} />{e.reasoning}%</span>
              <span className={`rk-cell mono${e.duplex === lead.duplex ? ' best' : ''}`}><em style={{ '--w': (e.duplex ?? 0) / 100 } as React.CSSProperties} />{e.duplex === null ? '–' : `${e.duplex}%`}</span>
              <span className={`rk-cell mono${e.ttfa === lead.ttfa ? ' best' : ''}`}>{e.ttfa === null ? '–' : `${e.ttfa.toFixed(2)} s`}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rk-two">
        <div className="rk-panel rk-pad">
          <span className="rk-k mono">How the index is built</span>
          <Donut parts={board.indexParts} outside={board.outside} />
        </div>
        <div className="rk-panel rk-pad">
          <span className="rk-k mono">Also worth knowing</span>
          {board.more.map((g) => (
            <div key={g.title} className="rk-more">
              <h4 className="serif">{g.title}</h4>
              <ul>{g.items.map(([a, b]) => <li key={a}><b>{a}</b>{b && <span>{b}</span>}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
      {board.important && <Callout tone="warn" title="Read this first">{board.important}</Callout>}
    </>
  );
}
