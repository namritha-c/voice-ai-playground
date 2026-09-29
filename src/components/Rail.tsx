import { NavLink, useLocation } from 'react-router-dom';
import { IconCompare, IconHistory, IconPlug, IconSliders, IconWave } from './Icons';

export function Logo() {
  return (
    <svg width="40" height="40" viewBox="-20 -20 40 40" aria-hidden="true" style={{ overflow: 'visible' }}>
      <circle className="ping" r="8" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle className="ping d2" r="8" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle r="4" fill="var(--accent)" />
    </svg>
  );
}

export default function Rail() {
  const loc = useLocation();
  const inPlayground = /^\/(tts|stt|sts)/.test(loc.pathname);
  return (
    <nav className="rail" aria-label="Primary">
      <div className="rail-logo"><Logo /></div>
      <NavLink to="/tts" className={`rail-btn${inPlayground ? ' on' : ''}`} aria-label="Playground" data-tip="PLAYGROUND"><IconWave /></NavLink>
      <button className="rail-btn" aria-label="Compare providers (coming soon)" data-tip="COMPARE · SOON" disabled><IconCompare /></button>
      <NavLink to="/history" className={({ isActive }) => `rail-btn${isActive ? ' on' : ''}`} aria-label="History" data-tip="HISTORY"><IconHistory /></NavLink>
      <NavLink to="/providers" className={({ isActive }) => `rail-btn${isActive ? ' on' : ''}`} aria-label="Providers" data-tip="PROVIDERS"><IconPlug /></NavLink>
      <div style={{ flexGrow: 1 }} />
      <button className="rail-btn" aria-label="Settings (coming soon)" data-tip="SETTINGS · SOON" disabled><IconSliders /></button>
      <span className="serif avatar" title="Resonance Lab">R</span>
    </nav>
  );
}
