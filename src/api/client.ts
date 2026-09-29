import { keys } from '../state/keys';
import type { Mode, ProviderInfo, Run, RunMeta, Voice } from './types';

export * from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const b = await res.json();
      if (b?.detail) msg = typeof b.detail === 'string' ? b.detail : JSON.stringify(b.detail);
    } catch { /* not json */ }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export interface RunConfig {
  provider: string;
  model: string;
  voice?: string | null;
  voice_name?: string | null;
  params: Record<string, unknown>;
}

/** The caller's own key for one provider, sent with every request that spends their credits. */
function withKey(provider: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, 'X-Provider-Key': keys.get(provider) } };
}

/** Must match `MAX_UPLOAD_BYTES` on the server (Vercel Functions cap bodies at 4.5 MB). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function audioForm(audio: Blob, cfg: RunConfig): FormData {
  if (audio.size > MAX_UPLOAD_BYTES) throw new ApiError('Audio is larger than 4 MB. Trim it to about 2 minutes.');
  const f = new FormData();
  f.append('audio', audio, 'audio.wav');
  f.append('config', JSON.stringify(cfg));
  return f;
}

/** Read an audio response: bytes in the body, run metadata base64-encoded in a header. */
async function audioRun(res: Response, input_text: string | null): Promise<Run> {
  if (!res.ok) return j<never>(res);
  const raw = res.headers.get('X-Resonance-Meta');
  if (!raw) throw new ApiError('response is missing run metadata');
  const meta = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)))) as RunMeta;
  return { ...meta, input_text, audio_url: URL.createObjectURL(await res.blob()) };
}

export const api = {
  health: () => fetch('/api/health').then(j<{ ok: boolean }>),
  providers: () => fetch('/api/providers').then(j<ProviderInfo[]>),
  voices: (pid: string, mode: Mode) =>
    fetch(`/api/providers/${pid}/voices?mode=${mode}`, withKey(pid)).then(j<{ source: string; voices: Voice[]; warning?: string }>),
  tts: (cfg: RunConfig & { text: string }) =>
    fetch('/api/tts', withKey(cfg.provider, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }))
      .then((r) => audioRun(r, cfg.text)),
  stt: async (audio: Blob, cfg: RunConfig): Promise<Run> => {
    const meta = await fetch('/api/stt', withKey(cfg.provider, { method: 'POST', body: audioForm(audio, cfg) })).then(j<RunMeta>);
    return { ...meta, input_text: null, audio_url: null };
  },
  sts: async (audio: Blob, cfg: RunConfig) =>
    fetch('/api/sts', withKey(cfg.provider, { method: 'POST', body: audioForm(audio, cfg) })).then((r) => audioRun(r, null)),
  /** Returns a blob URL for a short sample in the voice. The GET is cached by the CDN and the browser. */
  preview: async (provider: string, voice: string, name: string) => {
    const r = await fetch(`/api/voices/preview?${new URLSearchParams({ provider, voice, name })}`, withKey(provider));
    if (!r.ok) return j<never>(r);
    return URL.createObjectURL(await r.blob());
  },
};

