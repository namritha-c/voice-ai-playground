import { describe, expect, it } from 'vitest';
import type { ParamSpec } from '@/api/client';
import { ProviderError } from '@/server/base';
import { normalize } from '@/server/params';

const SPEC = [
  { key: 'speed', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
  { key: 'rate', type: 'range', min: -50, max: 50, step: 1, default: 0 },
  { key: 'boost', type: 'bool', default: true },
  { key: 'lang', type: 'enum', options: ['en', 'hi'], default: 'en' },
  { key: 'note', type: 'text', default: '' },
  { key: 'vol', type: 'range', min: 0, max: 2, step: 0.1, default: 1, models: ['m3'] },
] as ParamSpec[];

describe('normalize', () => {
  it('fills defaults and drops unknown keys', () => {
    expect(normalize(SPEC, { emotion: 'happy' }, 'm2')).toEqual({ speed: 1, rate: 0, boost: true, lang: 'en' });
  });

  it('clamps and casts', () => {
    const out = normalize(SPEC, { speed: 9, rate: '-80.4', boost: 'false' }, 'm3');
    expect(out.speed).toBe(2);
    expect(out.rate).toBe(-50);
    expect(Number.isInteger(out.rate)).toBe(true);
    expect(out.boost).toBe(false);
    expect(out.vol).toBe(1);
  });

  it('rejects a bad enum value', () => {
    expect(() => normalize(SPEC, { lang: 'fr' })).toThrow(ProviderError);
  });

  it('rejects a non-numeric range value', () => {
    expect(() => normalize(SPEC, { speed: 'fast' })).toThrow(/must be a number/);
  });
});
