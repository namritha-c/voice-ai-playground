/**
 * Adapter contract every provider implements.
 *
 * A provider lives in `src/server/providers/<id>/` and consists of:
 *   - `manifest.json` — what the UI shows (modes, models, voices, params)
 *   - `adapter.ts`    — an object implementing `ProviderAdapter`
 *
 * Adapters receive params that were already validated against the manifest
 * (see `params.ts`), so they only need to map them onto the provider's API.
 */
import 'server-only';
import type { Voice, Word } from '@/api/types';

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

type Params = Record<string, unknown>;

/** Every request carries the caller's own API key (BYOK). The server holds no keys. */
export interface TTSRequest { key: string; model: string; voice: string | null; text: string; params: Params }
/** `audio` is 16 kHz mono 16-bit WAV, produced by the web client. */
export interface STTRequest { key: string; model: string; audio: Uint8Array; mime: string; params: Params }
export interface STSRequest { key: string; model: string; voice: string | null; audio: Uint8Array; mime: string; params: Params }

export interface AudioResult { audio: Uint8Array; mime: string; ext: string; metric_ms: number; request_preview: string }
export interface TranscriptResult { text: string; metric_ms: number; words: Word[]; language: string | null; request_preview: string }

export interface ProviderAdapter {
  tts?(req: TTSRequest): Promise<AudioResult>;
  stt?(req: STTRequest): Promise<TranscriptResult>;
  sts?(req: STSRequest): Promise<AudioResult>;
  /** Only called when the manifest declares `voices.source == "dynamic"`. */
  listVoices?(mode: string, key: string): Promise<Voice[]>;
}

export const PROVIDER_TIMEOUT_MS = 90_000;

export interface Timed {
  body: Uint8Array;
  status: number;
  headers: Headers;
  ttfb_ms: number;
  total_ms: number;
  json<T = any>(): T;
}

/** Send a request, measuring time to first byte of the body. */
export async function request(id: string, url: string, init: RequestInit): Promise<Timed> {
  const t0 = performance.now();
  let ttfb: number | null = null;
  const chunks: Uint8Array[] = [];
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    const reader = res.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ttfb === null) ttfb = performance.now();
        chunks.push(value);
      }
    }
  } catch (e) {
    throw new ProviderError(`${id}: network error — ${(e as Error).message}`);
  }
  const t1 = performance.now();
  const body = concat(chunks);
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(`${id} rejected your API key (${res.status}). Check it and paste a new one.`, 401);
  }
  if (res.status >= 400) {
    throw new ProviderError(`${id} returned ${res.status}: ${redact(errText(body), init.headers)}`, res.status === 400 || res.status === 422 ? 400 : 502);
  }
  return {
    body,
    status: res.status,
    headers: res.headers,
    ttfb_ms: Math.round((ttfb ?? t1) - t0),
    total_ms: Math.round(t1 - t0),
    json: () => JSON.parse(new TextDecoder().decode(body)),
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Upstream error text can echo a credential back. Strip every header value we sent before it reaches the client. */
function redact(text: string, headers: HeadersInit | undefined): string {
  if (!headers) return text;
  let out = text;
  for (const [k, v] of Object.entries(headers as Record<string, string>)) {
    if (!SECRET_HEADERS.has(k.toLowerCase())) continue;
    for (const secret of new Set([v, v.replace(/^(Bearer|Token)\s+/i, '')])) {
      if (secret.length >= 6) out = out.split(secret).join('***');
    }
  }
  return out;
}

export function errText(body: Uint8Array): string {
  const raw = new TextDecoder().decode(body);
  try {
    const data = JSON.parse(raw);
    for (const k of ['detail', 'error', 'message', 'err_msg']) {
      if (k in data) {
        let v = data[k];
        if (v && typeof v === 'object') v = v.message ?? v.msg ?? JSON.stringify(v);
        return String(v).slice(0, 500);
      }
    }
    return JSON.stringify(data).slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

const SECRET_HEADERS = new Set(['authorization', 'xi-api-key', 'api-subscription-key', 'ocp-apim-subscription-key', 'x-api-key']);
/** Long input text is cut in the preview so it fits in a response header. */
const PREVIEW_TEXT_MAX = 300;

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function truncateText(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const b = body as Record<string, unknown>;
  if (typeof b.text === 'string' && b.text.length > PREVIEW_TEXT_MAX) return { ...b, text: `${b.text.slice(0, PREVIEW_TEXT_MAX)}…` };
  return body;
}

/** Build a copy-pasteable curl command with credentials redacted. */
export function curlPreview(method: string, url: string, opts: {
  headers?: Record<string, string>; json?: unknown; form?: Record<string, string>; dataNote?: string;
} = {}): string {
  const lines = [`curl -X ${method.toUpperCase()} ${q(url)}`];
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (SECRET_HEADERS.has(k.toLowerCase())) {
      lines.push(`-H "${k}: ${v.toLowerCase().startsWith('bearer') ? 'Bearer $API_KEY' : '$API_KEY'}"`);
    } else {
      lines.push(`-H ${q(`${k}: ${v}`)}`);
    }
  }
  if (opts.json !== undefined) lines.push(`-d ${q(JSON.stringify(truncateText(opts.json)))}`);
  for (const [k, v] of Object.entries(opts.form ?? {})) lines.push(`-F ${q(`${k}=${v}`)}`);
  if (opts.dataNote) lines.push(`--data-binary ${q(opts.dataNote)}`);
  return lines.join(' \\\n  ');
}

export function toForm(fields: Record<string, string>, file: { field: string; name: string; data: Uint8Array; mime: string }): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  f.append(file.field, new Blob([file.data as BlobPart], { type: file.mime }), file.name);
  return f;
}
