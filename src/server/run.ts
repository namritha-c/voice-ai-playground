/** Shared request handling for the run routes (tts / stt / sts / preview). Nothing is stored. */
import 'server-only';
import type { Mode, RunMeta } from '@/api/types';
import { ProviderError, type AudioResult } from './base';
import { applies, normalize } from './params';
import { get, type Provider } from './registry';

/** Vercel Functions cap request bodies at 4.5 MB; stay under it with room for the form fields. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const META_HEADER = 'X-Resonance-Meta';
export const KEY_HEADER = 'X-Provider-Key';

/**
 * BYOK: the caller's own API key arrives in a header on every request. The server keeps no keys,
 * never stores or logs this one, and only forwards it to the provider it belongs to.
 */
export function apiKey(req: Request, p: Provider): string {
  const key = req.headers.get(KEY_HEADER)?.trim() ?? '';
  if (!key) throw new ProviderError(`Add your ${p.name} API key to use it.`, 401);
  if (key.length > 512) throw new ProviderError(`That doesn't look like a ${p.name} API key.`, 400);
  return key;
}

/** Turn a thrown error into the `{ detail }` JSON the client expects. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ProviderError) return Response.json({ detail: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ detail: 'internal error' }, { status: 500 });
  }
}

export function newId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(16).padStart(11, '0')}${rand}`;
}

export function prepare(mode: Mode, pid: string, model: string, voice: string | null | undefined, raw: Record<string, unknown> | undefined) {
  const p = get(pid);
  const spec = p.mode(mode);
  if (!spec.models.includes(model)) throw new ProviderError(`unknown model '${model}' for ${p.name}`, 400);
  const vs = spec.voices;
  if (vs) {
    if (!voice) throw new ProviderError('this provider needs a voice', 400);
    if (vs.source === 'static') {
      const v = vs.items.find((x) => x.id === voice);
      if (!v || !applies(v, model)) throw new ProviderError(`voice '${voice}' is not available for ${model}`, 400);
    }
  } else {
    voice = null;
  }
  return { p, spec, voice: voice ?? null, params: normalize(spec.params ?? [], raw, model) };
}

export interface RunConfigBody {
  provider: string;
  model: string;
  voice?: string | null;
  voice_name?: string | null;
  params?: Record<string, unknown>;
}

function isConfig(x: unknown): x is RunConfigBody {
  const c = x as RunConfigBody;
  return !!c && typeof c === 'object' && typeof c.provider === 'string' && typeof c.model === 'string'
    && (c.params === undefined || (typeof c.params === 'object' && c.params !== null));
}

export async function readJson(req: Request): Promise<RunConfigBody & { text?: unknown }> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new ProviderError('invalid JSON body', 400); }
  if (!isConfig(body)) throw new ProviderError('invalid config: provider and model are required', 400);
  return body;
}

/** Parse the multipart `audio` + `config` fields sent by the STT and STS modes. */
export async function readUpload(req: Request): Promise<{ cfg: RunConfigBody; audio: Uint8Array; mime: string }> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) throw tooLarge();
  let form: FormData;
  try { form = await req.formData(); } catch { throw new ProviderError('expected multipart form data', 400); }
  let cfg: unknown;
  try { cfg = JSON.parse(String(form.get('config') ?? '')); } catch (e) { throw new ProviderError(`invalid config: ${(e as Error).message}`, 400); }
  if (!isConfig(cfg)) throw new ProviderError('invalid config: provider and model are required', 400);
  const file = form.get('audio');
  if (!(file instanceof Blob) || file.size === 0) throw new ProviderError('empty audio', 400);
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge();
  return { cfg, audio: new Uint8Array(await file.arrayBuffer()), mime: file.type || 'audio/wav' };
}

const tooLarge = () => new ProviderError(`audio is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB — trim it to about 2 minutes`, 413);

/** Send audio bytes back with the run metadata in a header, so the body stays binary (no base64 bloat). */
export function audioResponse(res: AudioResult, meta: Omit<RunMeta, 'metric_ms' | 'request_preview' | 'ext'>): Response {
  const full: RunMeta = { ...meta, ext: res.ext, metric_ms: res.metric_ms, request_preview: res.request_preview };
  return new Response(res.audio as BodyInit, {
    headers: {
      'Content-Type': res.mime,
      [META_HEADER]: Buffer.from(JSON.stringify(full)).toString('base64'),
      'Cache-Control': 'no-store',
    },
  });
}
