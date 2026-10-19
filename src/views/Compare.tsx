'use client';

import NavLink from '../components/NavLink';
import { Callout, ProviderTile, Warn } from '../components/rankings/kit';
import { CHECKED, GROUPS, SOURCES, TAKEAWAY } from '../data/compare';
import { PLATFORMS } from '../data/platforms';
import { useBorrowMode } from '../lib/pageMode';
import { useClock } from '../lib/useClock';
import { PageBackdrop, PageTitle } from './Providers';

const LIVE = PLATFORMS.filter((p) => !p.soon);
const SOON = PLATFORMS.filter((p) => p.soon);

export default function Compare() {
  const t = useClock(20);
  useBorrowMode('sts');

  return (
    <main className="page rk cmp">
      <PageBackdrop />
      <div className="rk-top">
        <PageTitle text="Compare." t={t} />
        <div className="rk-stamp">
          <span className="rk-stamp-dot" aria-hidden="true" />
          <div>
            <span className="rk-stamp-k mono">Last checked</span>
            <span className="serif rk-stamp-v">{CHECKED}</span>
          </div>
        </div>
        <div style={{ flexGrow: 1 }} />
        <NavLink href="/platforms" className="pf-back">← Platform guides</NavLink>
      </div>

      <div className="rk-cat">
        <header className="rk-cat-head">
          <h2 className="rk-cat-title serif" aria-label="Voice agent platforms, side by side">
            {'Voice agent platforms, side by side'.split(' ').map((w, i) => (
              <span key={i} className="rk-word" style={{ animationDelay: `${0.05 + i * 0.09}s` }}>{w}&nbsp;</span>
            ))}
          </h2>
          <p className="rk-takeaway">{TAKEAWAY}</p>
        </header>

        <div className="rk-panel cmp-panel">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col" className="cmp-corner"><span className="rk-k mono">Accent = stronger option</span></th>
                {LIVE.map((p) => (
                  <th key={p.id} scope="col">
                    <NavLink href={`/platforms#${p.id}`} className="cmp-who">
                      <ProviderTile names={[p.name]} size={36} />
                      <span>
                        <span className="rk-name">{p.name}</span>
                        <span className="rk-by"><span className="rk-tag">{p.kind}</span><span>{p.by}</span></span>
                      </span>
                    </NavLink>
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((g) => (
              <tbody key={g.title}>
                <tr className="cmp-group"><th scope="rowgroup" colSpan={LIVE.length + 1}><span className="rk-k mono">{g.title}</span></th></tr>
                {g.rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="cmp-label">
                      <span className="cmp-l">{r.label}</span>
                      {r.hint && <span className="cmp-hint">{r.hint}</span>}
                      {r.flag && <Warn>{r.flag}</Warn>}
                    </th>
                    {LIVE.map((p) => {
                      const c = r.cells[p.id];
                      return (
                        <td key={p.id} className={c?.win ? 'win' : undefined} data-who={p.name}>
                          <span className="cmp-v">{c?.v ?? '–'}</span>
                          {c?.note && <span className="cmp-note">{c.note}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        {SOON.length > 0 && (
          <Callout tone="note" title="Coming soon">
            {SOON.map((p) => p.name).join(', ')} will join this table once {SOON.length > 1 ? 'their guides are' : 'its guide is'} written.
          </Callout>
        )}
      </div>

      <footer className="rk-foot">
        <span className="rk-k mono">Where the numbers come from</span>
        <ul>{SOURCES.map((s) => <li key={s}>{s}</li>)}</ul>
        <Callout tone="note" title="How to read this table">
          Prices are list prices on the date above and leave out model costs unless the row says otherwise. Latency depends mostly on the STT, LLM and TTS you choose, so test with your own stack before you decide.
        </Callout>
      </footer>
    </main>
  );
}
