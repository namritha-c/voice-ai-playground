/** The providers this app ships with. Add one by adding its folder and a line below. */
import 'server-only';
import { MODES, type Mode, type ModeSpec, type Provider as PublicProvider } from '@/api/client';
import { env, ProviderError, type ProviderAdapter } from './base';
import { adapter as deepgram } from './providers/deepgram/adapter';
import deepgramManifest from './providers/deepgram/manifest.json';
import { adapter as elevenlabs } from './providers/elevenlabs/adapter';
import elevenlabsManifest from './providers/elevenlabs/manifest.json';
import { adapter as sarvam } from './providers/sarvam/adapter';
import sarvamManifest from './providers/sarvam/manifest.json';

export interface Manifest {
  id: string;
  name: string;
  mono?: string;
  env: string[];
  modes: Partial<Record<Mode, ModeSpec>>;
}

export class Provider {
  constructor(readonly manifest: Manifest, readonly adapter: ProviderAdapter) {}

  get id() { return this.manifest.id; }
  get name() { return this.manifest.name; }
  get missingEnv() { return this.manifest.env.filter((k) => !env(k)); }
  get connected() { return this.missingEnv.length === 0; }

  mode(mode: string): ModeSpec {
    const m = this.manifest.modes[mode as Mode];
    if (!m) throw new ProviderError(`${this.name} does not support ${mode.toUpperCase()}`, 400);
    return m;
  }

  public(): PublicProvider {
    const m = this.manifest;
    return {
      id: m.id,
      name: m.name,
      mono: m.mono ?? m.name.slice(0, 2),
      connected: this.connected,
      missing_env: this.missingEnv,
      caps: MODES.filter((k) => k in m.modes),
      modes: m.modes,
    };
  }
}

export const providers: Provider[] = [
  new Provider(elevenlabsManifest as Manifest, elevenlabs),
  new Provider(deepgramManifest as Manifest, deepgram),
  new Provider(sarvamManifest as Manifest, sarvam),
];

export function get(pid: string): Provider {
  const p = providers.find((x) => x.id === pid);
  if (!p) throw new ProviderError(`unknown provider '${pid}'`, 404);
  return p;
}
