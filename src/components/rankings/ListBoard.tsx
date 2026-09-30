'use client';

import type { CSSProperties } from 'react';
import type { FlowStep, ListBoard as Board, ListEntry, ListGroup } from '../../data/rankings';
import { Callout, ProviderTile, Tag, Warn, along } from './kit';

/** A live signal chain. A packet of light walks the steps in order and each step lights as it arrives. */
function Flow({ title, steps }: { title: string; steps: FlowStep[] }) {
  return (
    <div className="rk-panel rk-flow">
      <span className="rk-k mono">{title}</span>
      <ol className="rk-flow-steps">
        {steps.map((s, i) => (
          <li key={s.name} style={{ '--i': i, '--n': steps.length } as CSSProperties}>
            <span className="rk-flow-node"><b className="serif">{s.name}</b><em>{s.ask}</em>{s.stat && <span className="mono">{s.stat}</span>}</span>
            {i < steps.length - 1 && <span className="rk-flow-wire" aria-hidden="true"><i /></span>}
          </li>
        ))}
      </ol>
      <div className="rk-wave" aria-hidden="true">{Array.from({ length: 44 }, (_, k) => <i key={k} style={{ '--k': k } as CSSProperties} />)}</div>
    </div>
  );
}

function Side({ e, group }: { e: ListEntry; group: ListGroup }) {
  if (e.meters) {
    return (
      <div className="rk-meters">
        {e.meters.map((m) => (
          <div key={m.label} className="rk-meter">
            <div className="rk-m-top"><span>{m.label}</span><span className="mono">{m.pct}%</span></div>
            <div className={`rk-m-bar${m.vendor ? ' vendor' : ''}`}><i style={{ '--w': m.pct / 100 } as CSSProperties} /></div>
          </div>
        ))}
      </div>
    );
  }
  if (e.range && group.axis) {
    const { domain, ticks, fmt } = group.axis;
    const a = along(e.range.min, domain), b = along(e.range.max, domain);
    return (
      <div className="rk-range">
        <span className="rk-range-label mono">{e.range.label}</span>
        <div className="rk-range-track">
          {ticks.map((t) => <u key={t} style={{ left: `${along(t, domain) * 100}%` }} title={fmt(t)} />)}
          <i style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }} />
        </div>
      </div>
    );
  }
  if (e.hero) return <div className="rk-hero"><span className="serif">{e.hero.v}</span><em>{e.hero.k}</em></div>;
  return null;
}

function Row({ e, group, i }: { e: ListEntry; group: ListGroup; i: number }) {
  const top = e.rank !== null && e.rank <= 3;
  return (
    <div className={`rk-row list${top ? ' top' : ''}`} style={{ '--i': i } as CSSProperties} role="listitem">
      <span className="rk-rank serif">{e.rank ?? '–'}</span>
      <div className="rk-who">
        <div className="rk-who-head">
          <ProviderTile name={e.by} />
          <div style={{ minWidth: 0 }}>
            <div className="rk-name">{e.name}</div>
            <div className="rk-by"><span>{e.by}</span>{e.kind && <Tag>{e.kind}</Tag>}</div>
          </div>
        </div>
        {e.note && <p className="rk-note">{e.note}</p>}
        {e.facts && <dl className="rk-facts">{e.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        {e.flag && <Warn>{e.flag}</Warn>}
      </div>
      <Side e={e} group={group} />
    </div>
  );
}

export default function ListBoard({ board }: { board: Board }) {
  let n = 0;
  return (
    <>
      <div className="rk-lead solo">
        <div className="rk-read">
          <p className="rk-takeaway serif">{board.takeaway}</p>
          {board.important && <Callout tone="warn" title="Read this first">{board.important}</Callout>}
        </div>
      </div>
      {board.flow && <Flow {...board.flow} />}
      {board.groups.map((g) => (
        <section key={g.title} className="rk-panel rk-board">
          <div className="rk-board-head">
            <div><span className="rk-k mono">{g.title}</span>{g.blurb && <span className="rk-scale">{g.blurb}</span>}</div>
            {g.axis && <span className="rk-dir mono">{g.axis.label}</span>}
          </div>
          {g.axis && (
            <div className="rk-axis list" aria-hidden="true">
              <div className="rk-ticks">
                {g.axis.ticks.map((t) => <span key={t} className="mono" style={{ left: `${along(t, g.axis!.domain) * 100}%` }}>{g.axis!.fmt(t)}</span>)}
              </div>
            </div>
          )}
          <div className="rk-rows" role="list">
            {g.entries.map((e) => <Row key={e.name} e={e} group={g} i={n++} />)}
          </div>
        </section>
      ))}
    </>
  );
}
