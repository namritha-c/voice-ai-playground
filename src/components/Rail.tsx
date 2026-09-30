'use client';

import { usePathname } from 'next/navigation';
import NavLink from './NavLink';
import { IconCompare, IconPlug, IconSliders, IconWave } from './Icons';

export default function Rail() {
  const path = usePathname();
  const inPlayground = /^\/(tts|stt|sts)/.test(path);
  return (
    <nav className="rail" aria-label="Primary">
      <NavLink href="/tts" className={`rail-btn${inPlayground ? ' on' : ''}`} aria-label="Playground" data-tip="PLAYGROUND"><IconWave /></NavLink>
      <button className="rail-btn" aria-label="Compare providers (coming soon)" data-tip="COMPARE · SOON" disabled><IconCompare /></button>
      <NavLink href="/providers" className={`rail-btn${path === '/providers' ? ' on' : ''}`} aria-label="Providers" data-tip="PROVIDERS"><IconPlug /></NavLink>
      <div style={{ flexGrow: 1 }} />
      <button className="rail-btn" aria-label="Settings (coming soon)" data-tip="SETTINGS · SOON" disabled><IconSliders /></button>
      <span className="serif avatar" title="Resonance Lab">R</span>
    </nav>
  );
}
