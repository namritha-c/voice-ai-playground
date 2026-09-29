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

export interface Run {
  id: string;
  created_at: string;
  mode: Mode;
  provider: string;
  provider_name: string;
  model: string;
  voice: string | null;
  voice_name: string | null;
  params: Record<string, unknown>;
  input_text: string | null;
  input_audio_url: string | null;
  audio_url: string | null;
  transcript: { text: string; language: string | null; words: Word[] } | null;
  metric_ms: number | null;
  status: 'ok' | 'error';
  error: string | null;
  request_preview: string | null;
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

function audioForm(audio: Blob, cfg: RunConfig): FormData {
  const f = new FormData();
  f.append('audio', audio, 'audio.wav');
  f.append('config', JSON.stringify(cfg));
  return f;
}

export const api = {
  health: () => fetch('/api/health').then(j<{ ok: boolean }>),
  providers: () => fetch('/api/providers').then(j<Provider[]>),
  voices: (pid: string, mode: Mode) =>
    fetch(`/api/providers/${pid}/voices?mode=${mode}`).then(j<{ source: string; voices: Voice[]; warning?: string }>),
  tts: (cfg: RunConfig & { text: string }) =>
    fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).then(j<Run>),
  stt: (audio: Blob, cfg: RunConfig) => fetch('/api/stt', { method: 'POST', body: audioForm(audio, cfg) }).then(j<Run>),
  sts: (audio: Blob, cfg: RunConfig) => fetch('/api/sts', { method: 'POST', body: audioForm(audio, cfg) }).then(j<Run>),
  preview: (provider: string, voice: string, name: string) =>
    fetch('/api/voices/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, voice, name }) })
      .then(j<{ audio_url: string }>),
  runs: (q: { mode?: string; provider?: string; status?: string; cursor?: string | null; limit?: number }) => {
    const u = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v) u.set(k, String(v)); });
    return fetch(`/api/runs?${u}`).then(j<{ items: Run[]; next: string | null }>);
  },
  run: (id: string) => fetch(`/api/runs/${id}`).then(j<Run>),
  deleteRun: (id: string) => fetch(`/api/runs/${id}`, { method: 'DELETE' }).then(j<{ ok: boolean }>),
};

export const optValue = (o: EnumOption) => (typeof o === 'string' ? o : o.value);
export const optLabel = (o: EnumOption) => (typeof o === 'string' ? o : o.label);
export const appliesTo = (x: { models?: string[] }, model: string) => !x.models || x.models.includes(model);
