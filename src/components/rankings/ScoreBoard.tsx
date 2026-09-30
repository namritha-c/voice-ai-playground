'use client';

import { Fragment } from 'react';
import type { ScoreBoard as Board, ScoreEntry } from '../../data/rankings';
import { Callout, Num, ProviderTile, Tag, TryPill, Warn, along, fmtMetric } from './kit';

const STAND = [150, 112, 88];
const ORDER = [1, 0, 2];

function Podium({ board }: { board: Board }) {
  const top = board.entries.slice(0, 3);
  const { metric } = board;
  return (
    <div className="rk-podium" role="list" aria-label="Top three">
      {ORDER.map((i) => {
        const e = top[i];
        if (!e || e.value === null) return null;
        return (
          <div key={e.model} role="listitem" className={`rk-pod p${i + 1}`} style={{ '--h': `${STAND[i]}px`, '--d': `${0.15 + i * 0.12}s` } as React.CSSProperties}>
            <div className="rk-pod-top">
              <ProviderTile name={e.provider} size={38} />
              <span className="rk-pod-name">{e.model}</span>
              <span className="rk-pod-by">{e.provider}</span>
              <span className="rk-pod-val serif"><Num value={e.value} decimals={metric.decimals} /><i>{metric.unit}</i></span>
            </div>
            <div className="rk-stand" aria-hidden="true"><span className="serif">{e.rank}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ e, board, i }: { e: ScoreEntry; board: Board; i: number }) {
  const { metric } = board;
  const top = e.rank !== null && e.rank <= 3;
  const w = e.value === null ? null : along(e.value, metric.domain);
  return (
    <div className={`rk-row${top ? ' top' : ''}`} style={{ '--i': i } as React.CSSProperties}>
      <span className="rk-rank serif">{e.rank ?? '–'}</span>
      <div className="rk-who">
        <div className="rk-who-head">
          <ProviderTile name={e.provider} />
          <div style={{ minWidth: 0 }}>
            <div className="rk-name">{e.model}</div>
            <div className="rk-by">
              <span>{e.provider}</span>
              {e.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </div>
          </div>
        </div>
        {e.note && <p className="rk-note">{e.note}</p>}
        {e.flag && <Warn>{e.flag}</Warn>}
        {e.try && <TryPill to={e.try} />}
      </div>
      <div className="rk-track" aria-hidden="true">
        {w === null ? <span className="rk-nobar">No score on this scale</span> : <i style={{ '--w': w } as React.CSSProperties} />}
      </div>
      <span className="rk-val mono">{e.value === null ? e.shown ?? '–' : fmtMetric(metric, e.value)}</span>
    </div>
  );
}

export default function ScoreBoard({ board }: { board: Board }) {
  const { metric, entries } = board;
  const arrow = metric.better === 'lower' ? '← lower is better' : 'higher is better →';
  let prev = 0;
  return (
    <>
      <div className={`rk-lead${board.podium ? '' : ' solo'}`}>
        {board.podium && <div className="rk-panel rk-podium-panel"><Podium board={board} /></div>}
        <div className="rk-read">
          <p className="rk-takeaway serif">{board.takeaway}</p>
          {board.important && <Callout tone="warn" title="Read this first">{board.important}</Callout>}
        </div>
      </div>

      <div className="rk-panel rk-board">
        <div className="rk-board-head">
          <div>
            <span className="rk-k mono">{metric.label}</span>
            <span className="rk-scale">{metric.scale}</span>
          </div>
          <span className="rk-dir mono">{arrow}</span>
        </div>
        <div className="rk-axis" aria-hidden="true">
          <span />
          <div className="rk-ticks">
            {metric.ticks.map((t) => (
              <span key={t} className="mono" style={{ left: `${along(t, metric.domain) * 100}%` }}>{t.toLocaleString('en-US')}{metric.unit}</span>
            ))}
          </div>
        </div>
        <div className="rk-rows" role="list">
          {entries.map((e, i) => {
            const gap = e.rank !== null && prev > 0 && e.rank > prev + 1 && !(e.rank === prev);
            if (e.rank !== null) prev = e.rank;
            return (
              <Fragment key={`${e.model}-${i}`}>
                {gap && <div className="rk-gap mono" aria-label="Ranks in between are not listed">· · · ranks in between not listed</div>}
                <Row e={e} board={board} i={i} />
              </Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
}
