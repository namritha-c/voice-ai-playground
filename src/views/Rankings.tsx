'use client';

import { useEffect, useRef, useState } from 'react';
import ListBoard from '../components/rankings/ListBoard';
import S2SBoard from '../components/rankings/S2SBoard';
import ScoreBoard from '../components/rankings/ScoreBoard';
import { Callout, stillNow } from '../components/rankings/kit';
import { CATEGORIES, CHECKED, SOURCES, type Board, type CatId, type Category } from '../data/rankings';
import { CAP_STYLE } from '../lib/anim';
import { useBorrowMode } from '../lib/pageMode';
import { useClock } from '../lib/useClock';
import { PageBackdrop, PageTitle } from './Providers';

const fromHash = (): CatId => {
  const h = window.location.hash.slice(1);
  return CATEGORIES.some((c) => c.id === h) ? (h as CatId) : 'stt';
};

const BoardView = ({ board }: { board: Board }) =>
  board.kind === 'score' ? <ScoreBoard board={board} /> : board.kind === 's2s' ? <S2SBoard board={board} /> : <ListBoard board={board} />;

function Terms({ cat }: { cat: Category }) {
  return (
    <details className="rk-panel rk-fold">
      <summary><span className="rk-k mono">Plain-English terms</span><span className="rk-count mono">{cat.terms.length}</span></summary>
      <dl className="rk-terms">
        {cat.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.def}</dd></div>)}
      </dl>
    </details>
  );
}

export default function Rankings() {
  const t = useClock(20);
  const [id, setId] = useState<CatId>(fromHash);
  const cat = CATEGORIES.find((c) => c.id === id)!;
  const [sub, setSub] = useState<Record<string, string>>({});
  const board = cat.boards.find((b) => b.id === sub[cat.id]) ?? cat.boards[0];
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useBorrowMode(cat.mode);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // On narrow screens the tabs are a sideways strip. Keep the picked tab centred in it. A strip that fits does not move.
  useEffect(() => {
    const el = strip.current;
    const on = el?.querySelector<HTMLElement>('.fchip.on');
    if (!el || !on || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2, behavior: stillNow() ? 'auto' : 'smooth' });
  }, [id]);

  const pick = (next: CatId) => {
    setId(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <main className="page rk">
      <PageBackdrop />
      <div className="rk-top">
        <PageTitle text="Rankings." t={t} />
        <div className="rk-stamp">
          <span className="rk-stamp-dot" aria-hidden="true" />
          <div>
            <span className="rk-stamp-k mono">Last checked</span>
            <span className="serif rk-stamp-v">{CHECKED}</span>
          </div>
        </div>
        <div style={{ flexGrow: 1 }} />
        <p className="rk-disclaimer">Scores change often. Check the live leaderboard before you decide.</p>
      </div>

      <div ref={sentinel} aria-hidden="true" style={{ height: 1, marginTop: 26 }} />
      <div ref={strip} className={`rk-tabs${stuck ? ' stuck' : ''}`} role="group" aria-label="Category">
        {CATEGORIES.map((c) => {
          const color = CAP_STYLE[c.mode][1];
          return (
            <button key={c.id} className={`fchip${c.id === id ? ' on' : ''}`} aria-pressed={c.id === id} onClick={() => pick(c.id)}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {c.label}
            </button>
          );
        })}
      </div>

      <div key={cat.id} className="rk-cat">
        <header className="rk-cat-head">
          <h2 className="rk-cat-title serif" aria-label={cat.title}>
            {cat.title.split(' ').map((w, i) => (
              <span key={i} className="rk-word" style={{ animationDelay: `${0.05 + i * 0.09}s` }}>{w}&nbsp;</span>
            ))}
          </h2>
          <p className="rk-cat-blurb">{cat.blurb}</p>
        </header>

        {cat.boards.length > 1 && (
          <div className="rk-subtabs" role="group" aria-label="Board">
            {cat.boards.map((b) => (
              <button key={b.id} className={`rk-sub${b.id === board.id ? ' on' : ''}`} aria-pressed={b.id === board.id} onClick={() => setSub((s) => ({ ...s, [cat.id]: b.id }))}>{b.label}</button>
            ))}
          </div>
        )}

        <div key={board.id} className="rk-body">
          <BoardView board={board} />
          {board.changed && (
            <details className="rk-panel rk-fold">
              <summary><span className="rk-k mono">Fixed this pass</span></summary>
              <p className="rk-changed">{board.changed}</p>
            </details>
          )}
        </div>

        <Terms cat={cat} />
      </div>

      <footer className="rk-foot">
        <span className="rk-k mono">Where the numbers come from</span>
        <ul>{SOURCES.map((s) => <li key={s}>{s}</li>)}</ul>
        <Callout tone="note" title="How to read this page">
          Highlighted rows are the top three. A bar is drawn only when a row has a score on the board’s own scale.
        </Callout>
      </footer>
    </main>
  );
}
