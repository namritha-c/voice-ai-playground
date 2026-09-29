export type Mode = 'tts' | 'stt' | 'sts';
export const MODES: Mode[] = ['tts', 'stt', 'sts'];

export type EnumOption = string | { value: string; label: string };

export interface ParamSpec {
  key: string;
  label: string;
  type: 'range' | 'bool' | 'enum' | 'text';
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: EnumOption[];
  promote?: boolean;
  placeholder?: string;
  models?: string[];
}

export interface Voice {
  id: string;
  name: string;
  desc?: string;
  preview_url?: string | null;
  models?: string[];
}

export interface ModeSpec {
  tag: string;
  models: string[];
  max_chars?: number;
  voices?: { source: 'static' | 'dynamic'; items: Voice[] };
  params: ParamSpec[];
}

export interface Provider {
  id: string;
  name: string;
  mono: string;
  connected: boolean;
  missing_env: string[];
  caps: Mode[];
  modes: Partial<Record<Mode, ModeSpec>>;
}

export interface Word {
  text: string;
  start: number | null;
  end: number | null;
  speaker: string | null;
}

export interface Transcript { text: string; language: string | null; words: Word[] }

/** What the server returns for a run: JSON for STT, the `X-Resonance-Meta` header for TTS and STS. Nothing is stored. */
export interface RunMeta {
  id: string;
  mode: Mode;
  provider: string;
  provider_name: string;
  model: string;
  voice: string | null;
  voice_name: string | null;
  params: Record<string, unknown>;
  transcript: Transcript | null;
  /** File extension of the output audio, e.g. `mp3`. Null for STT. */
  ext: string | null;
  metric_ms: number | null;
  request_preview: string | null;
}

/** A run as the client holds it: the output audio lives in a blob URL for this tab only. */
export interface Run extends RunMeta {
  input_text: string | null;
  audio_url: string | null;
}

export class ApiError extends Error {}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const b = await res.json();
      if (b?.detail) msg = typeof b.detail === 'string' ? b.detail : JSON.stringify(b.detail);
    } catch { /* not json */ }
    throw new ApiError(msg);
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
  providers: () => fetch('/api/providers').then(j<Provider[]>),
  voices: (pid: string, mode: Mode) =>
    fetch(`/api/providers/${pid}/voices?mode=${mode}`).then(j<{ source: string; voices: Voice[]; warning?: string }>),
  tts: (cfg: RunConfig & { text: string }) =>
    fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      .then((r) => audioRun(r, cfg.text)),
  stt: async (audio: Blob, cfg: RunConfig): Promise<Run> => {
    const meta = await fetch('/api/stt', { method: 'POST', body: audioForm(audio, cfg) }).then(j<RunMeta>);
    return { ...meta, input_text: null, audio_url: null };
  },
  sts: async (audio: Blob, cfg: RunConfig) =>
    fetch('/api/sts', { method: 'POST', body: audioForm(audio, cfg) }).then((r) => audioRun(r, null)),
  /** Returns a blob URL for a short sample in the voice. The GET is cached by the CDN and the browser. */
  preview: async (provider: string, voice: string, name: string) => {
    const r = await fetch(`/api/voices/preview?${new URLSearchParams({ provider, voice, name })}`);
    if (!r.ok) return j<never>(r);
    return URL.createObjectURL(await r.blob());
  },
};

export const optValue = (o: EnumOption) => (typeof o === 'string' ? o : o.value);
export const optLabel = (o: EnumOption) => (typeof o === 'string' ? o : o.label);
export const appliesTo = (x: { models?: string[] }, model: string) => !x.models || x.models.includes(model);
