'use client';

import { usePathname } from 'next/navigation';
import NavLink from './NavLink';
import { IconAgent, IconCompare, IconPlug, IconSliders, IconTrophy, IconWave } from './Icons';

export default function Rail() {
  const path = usePathname();
  const inPlayground = /^\/(tts|stt|sts)/.test(path);
  return (
    <nav className="rail" aria-label="Primary">
      <NavLink href="/tts" className={`rail-btn${inPlayground ? ' on' : ''}`} aria-label="Playground" data-tip="PLAYGROUND"><IconWave /></NavLink>
      <NavLink href="/rankings" className={`rail-btn${path === '/rankings' ? ' on' : ''}`} aria-label="Rankings" data-tip="RANKINGS"><IconTrophy /></NavLink>
      <NavLink href="/platforms" className={`rail-btn${path === '/platforms' ? ' on' : ''}`} aria-label="Agent platforms" data-tip="PLATFORMS"><IconAgent /></NavLink>
      <NavLink href="/compare" className={`rail-btn${path === '/compare' ? ' on' : ''}`} aria-label="Compare platforms" data-tip="COMPARE"><IconCompare /></NavLink>
      <NavLink href="/providers" className={`rail-btn${path === '/providers' ? ' on' : ''}`} aria-label="Providers" data-tip="PROVIDERS"><IconPlug /></NavLink>
      <div style={{ flexGrow: 1 }} />
      <button className="rail-btn" aria-label="Settings (coming soon)" data-tip="SETTINGS · SOON" disabled><IconSliders /></button>
      <span className="serif avatar" title="Resonance Lab">R</span>
    </nav>
  );
}
