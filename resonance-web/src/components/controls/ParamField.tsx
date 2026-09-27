import { optLabel, optValue, type ParamSpec } from '../../api/client';

export function fmtNum(x: number, p: ParamSpec): string {
  const step = p.step ?? 1;
  const d = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return (+x).toFixed(d) + (p.unit ?? '');
}

export default function ParamField({ id, spec, value, onChange }: { id: string; spec: ParamSpec; value: unknown; onChange: (v: unknown) => void }) {
  if (spec.type === 'range') {
    const v = Number(value ?? spec.default ?? spec.min ?? 0);
    const min = spec.min ?? 0, max = spec.max ?? 1;
    const pc = (((v - min) / (max - min)) * 100).toFixed(1);
    return (
      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label htmlFor={id} className="plabel">{spec.label}</label>
          <span className="pval">{fmtNum(v, spec)}</span>
        </div>
        <input id={id} className="rng" type="range" min={min} max={max} step={spec.step ?? 0.01} value={v}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={() => onChange(spec.default)}
          style={{ background: `linear-gradient(90deg, var(--accent) ${pc}%, var(--line-2) ${pc}%)` }} />
      </div>
    );
  }
  if (spec.type === 'bool') {
    const on = Boolean(value ?? spec.default);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
        <span className="plabel">{spec.label}</span>
        <button role="switch" aria-checked={on} aria-label={spec.label} className={`sw${on ? ' on' : ''}`} onClick={() => onChange(!on)}><span /></button>
      </div>
    );
  }
  if (spec.type === 'enum') {
    const cur = value ?? spec.default;
    return (
      <div className="field">
        <span className="plabel">{spec.label}</span>
        <div className="chips" role="group" aria-label={spec.label}>
          {(spec.options ?? []).map((o) => {
            const val = optValue(o);
            return <button key={val} className={`chip${val === cur ? ' on' : ''}`} aria-pressed={val === cur} onClick={() => onChange(val)}>{optLabel(o)}</button>;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id} className="plabel">{spec.label}</label>
      <textarea id={id} className="txt" rows={2} value={String(value ?? spec.default ?? '')} placeholder={spec.placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
