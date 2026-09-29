// Shapes shared by the server routes and the browser. Nothing here touches the browser or the server.
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

/** What the server publishes about a provider. */
export interface ProviderInfo {
  id: string;
  name: string;
  mono: string;
  /** Where a person creates an API key for this provider. */
  key_url: string;
  caps: Mode[];
  modes: Partial<Record<Mode, ModeSpec>>;
}

/** A provider as the UI sees it: `connected` means this browser holds a key for it. */
export interface Provider extends ProviderInfo {
  connected: boolean;
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

export const optValue = (o: EnumOption) => (typeof o === 'string' ? o : o.value);
export const optLabel = (o: EnumOption) => (typeof o === 'string' ? o : o.label);
export const appliesTo = (x: { models?: string[] }, model: string) => !x.models || x.models.includes(model);
