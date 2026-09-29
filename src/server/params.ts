/**
 * Validate user-supplied params against a provider manifest.
 *
 * Only params the manifest declares survive, so a provider never receives an
 * option it does not understand (no `emotion` for providers without one, etc.).
 */
import type { ParamSpec } from '@/api/client';
import { ProviderError } from './base';

/** Params and voices may be limited to some models via a `models` list. */
export function applies(item: { models?: string[] }, model: string | null | undefined): boolean {
  return !item.models?.length || (model != null && item.models.includes(model));
}

export function normalize(spec: ParamSpec[], raw: Record<string, unknown> | null | undefined, model?: string | null): Record<string, unknown> {
  raw ??= {};
  const out: Record<string, unknown> = {};
  for (const p of spec) {
    if (!applies(p, model)) continue;
    const { key, type } = p;
    const val = key in raw ? raw[key] : p.default;
    if (val === undefined || val === null) continue;
    if (type === 'range') {
      let v = Number(val);
      if (val === '' || !Number.isFinite(v)) throw new ProviderError(`'${key}' must be a number`, 400);
      v = Math.min(Math.max(v, p.min!), p.max!);
      if (p.step && Number.isInteger(p.step) && Number.isInteger(p.min)) v = Math.round(v);
      out[key] = v;
    } else if (type === 'bool') {
      out[key] = typeof val === 'boolean' ? val : ['1', 'true', 'yes', 'on'].includes(String(val).toLowerCase());
    } else if (type === 'enum') {
      const opts = (p.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
      if (!opts.includes(val as string)) {
        throw new ProviderError(`'${val}' is not a valid ${p.label ?? key} (expected one of ${opts.join(', ')})`, 400);
      }
      out[key] = val;
    } else if (type === 'text') {
      const s = String(val).trim();
      if (s) out[key] = s.slice(0, p.max ?? 4000);
    } else {
      throw new ProviderError(`unknown param type ${type}`, 500);
    }
  }
  return out;
}
