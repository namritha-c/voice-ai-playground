'use client';

import { useEffect, useState, type ReactNode } from 'react';
import NavLink from '../components/NavLink';
import { IconArrowUpRight, IconCheck, IconClose } from '../components/Icons';
import { Callout, ProviderTile } from '../components/rankings/kit';
import { CHECKED, PLATFORMS, type Platform, type PlatformId } from '../data/platforms';
import { useBorrowMode } from '../lib/pageMode';
import { useClock } from '../lib/useClock';
import { PageBackdrop, PageTitle } from './Providers';

const fromHash = (): PlatformId => {
  const h = window.location.hash.slice(1);
  return PLATFORMS.some((p) => p.id === h) ? (h as PlatformId) : 'vapi';
};

function Section({ k, children, i = 0 }: { k: string; children: ReactNode; i?: number }) {
  return (
    <section className="rk-panel pf-sec" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
      <span className="rk-k mono">{k}</span>
      {children}
    </section>
  );
}

function Guide({ p }: { p: Platform }) {
  return (
    <div className="pf-body">
      <Section k="When to use" i={0}>
        <ul className="pf-bullets">{p.whenToUse.map((x) => <li key={x}>{x}</li>)}</ul>
        <span className="rk-k mono pf-sub">Skip it if</span>
        <ul className="pf-bullets mute">{p.whenNot.map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>

      <div className="pf-two">
        <Section k="Pros" i={1}>
          <ul className="pf-list pro">{p.pros.map((x) => <li key={x}><IconCheck size={14} /><span>{x}</span></li>)}</ul>
        </Section>
        <Section k="Cons" i={2}>
          <ul className="pf-list con">{p.cons.map((x) => <li key={x}><IconClose size={13} /><span>{x}</span></li>)}</ul>
        </Section>
      </div>

      <Section k="How to use" i={3}>
        <ol className="pf-steps">
          {p.howToUse.map((s, n) => (
            <li key={s.step}>
              <span className="pf-n serif">{n + 1}</span>
              <div>
                <b className="pf-step">{s.step}</b>
                <p>{s.detail}</p>
                {s.code && <pre className="pf-code mono"><code>{s.code}</code></pre>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section k="Novel features" i={4}>
        <div className="pf-grid">
          {p.novel.map((f) => (
            <div key={f.title} className="pf-feat">
              <b className="serif">{f.title}</b>
              <p>{f.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="pf-links">
        {p.links.map((l) => (
          <a key={l.href} className="rk-try" href={l.href} target="_blank" rel="noreferrer">{l.label}<IconArrowUpRight size={13} /></a>
        ))}
      </div>
    </div>
  );
}

export default function Platforms() {
  const t = useClock(20);
  const [id, setId] = useState<PlatformId>(fromHash);
  const p = PLATFORMS.find((x) => x.id === id)!;
  useBorrowMode('sts');

  // A client-side route change sets the hash after the first render, and a hash-only link fires no remount. Re-read it in both cases.
  useEffect(() => {
    const sync = () => setId(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const pick = (next: PlatformId) => {
    setId(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <main className="page rk pf">
      <PageBackdrop />
      <div className="rk-top">
        <PageTitle text="Platforms." t={t} />
        <div className="rk-stamp">
          <span className="rk-stamp-dot" aria-hidden="true" />
          <div>
            <span className="rk-stamp-k mono">Last checked</span>
            <span className="serif rk-stamp-v">{CHECKED}</span>
          </div>
        </div>
        <div style={{ flexGrow: 1 }} />
        <NavLink href="/rankings#agents" className="pf-back">← Agent platform rankings</NavLink>
      </div>

      <div className="rk-tabs pf-tabs" role="group" aria-label="Platform">
        {PLATFORMS.map((x) => (
          <button key={x.id} className={`fchip${x.id === id ? ' on' : ''}`} aria-pressed={x.id === id} disabled={x.soon} onClick={() => pick(x.id)}>
            <ProviderTile names={[x.name]} size={20} />
            {x.name}
            {x.soon && <span className="pf-soon mono">Soon</span>}
          </button>
        ))}
      </div>

      <div key={p.id} className="rk-cat">
        <header className="rk-cat-head pf-head">
          <ProviderTile names={[p.name]} size={56} />
          <div>
            <h2 className="rk-cat-title serif" aria-label={p.name}>
              {p.name.split(' ').map((w, i) => (
                <span key={i} className="rk-word" style={{ animationDelay: `${0.05 + i * 0.09}s` }}>{w}&nbsp;</span>
              ))}
            </h2>
            <div className="rk-by"><span className="rk-tag hot">{p.kind}</span><span>{p.by}</span></div>
          </div>
          <p className="rk-cat-blurb">{p.tagline}</p>
        </header>

        {p.soon ? (
          <Callout tone="note" title="Coming soon">The {p.name} guide is being written. Its ranking is on the Agent platforms board for now.</Callout>
        ) : <Guide p={p} />}
      </div>

      <footer className="rk-foot">
        <Callout tone="note" title="How to read this page">
          Pros, cons and features are a summary of each vendor’s docs and pricing at the date above. Vendors ship often, so check the linked docs before you decide.
        </Callout>
      </footer>
    </main>
  );
}
