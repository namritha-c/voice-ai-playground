import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderInfo, RunMeta } from '@/api/types';
import { GET as providersGET } from '@/app/api/providers/route';
import { GET as voicesGET } from '@/app/api/providers/[pid]/voices/route';
import { POST as stsPOST } from '@/app/api/sts/route';
import { POST as sttPOST } from '@/app/api/stt/route';
import { POST as ttsPOST } from '@/app/api/tts/route';
import { GET as previewGET } from '@/app/api/voices/preview/route';
import { MAX_UPLOAD_BYTES } from '@/server/run';

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

/** Replace global fetch with a stub that answers every provider call with `res`. */
function mockFetch(res: () => Response) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return res();
  }));
}

function wavBytes(seconds = 0.2, rate = 16000): Uint8Array {
  const n = Math.floor(rate * seconds);
  const out = new Uint8Array(44 + n * 2);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  return out;
}

/** BYOK: the caller's own key rides in a header. The server has none. */
const KEY = 'user-secret-key-123456';
const withKey = (key: string | null): Record<string, string> => (key ? { 'X-Provider-Key': key } : {});

const json = (body: unknown, key: string | null = KEY) => new Request('http://test/api/tts', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...withKey(key) }, body: JSON.stringify(body),
});

function upload(audio: Uint8Array, cfg: unknown, key: string | null = KEY, url = 'http://test/api/stt') {
  const f = new FormData();
  f.append('audio', new Blob([audio as BlobPart], { type: 'audio/wav' }), 'a.wav');
  f.append('config', JSON.stringify(cfg));
  return new Request(url, { method: 'POST', headers: withKey(key), body: f });
}

const meta = (res: Response): RunMeta => JSON.parse(Buffer.from(res.headers.get('X-Resonance-Meta')!, 'base64').toString());
const sentHeaders = (i = 0) => calls[i].init.headers as Record<string, string>;

const EL_TTS = { provider: 'elevenlabs', model: 'eleven_flash_v2_5', voice: '21m00Tcm4TlvDq8ikWAM', text: 'Hello there' };

beforeEach(() => {
  // Keys in the server environment must be ignored: this is a bring-your-own-key platform.
  vi.stubEnv('ELEVENLABS_API_KEY', 'server-env-key');
  vi.stubEnv('DEEPGRAM_API_KEY', 'server-env-key');
  vi.stubEnv('SARVAM_API_KEY', 'server-env-key');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('/api/providers', () => {
  it('lists the three providers in order with where to get a key, and holds no credentials', async () => {
    const res = providersGET();
    const text = await res.text();
    const list: ProviderInfo[] = JSON.parse(text);
    expect(list.map((p) => p.id)).toEqual(['elevenlabs', 'deepgram', 'sarvam']);
    expect(list.every((p) => p.key_url.startsWith('https://'))).toBe(true);
    expect(text).not.toContain('server-env-key');
    expect(text).not.toContain('connected'); // whether a key exists is a browser fact, not a server one
    expect(res.headers.get('Cache-Control')).toContain('public'); // same for everyone, so a CDN may cache it
  });
});

describe('bring your own key', () => {
  it.each([
    ['tts', () => ttsPOST(json(EL_TTS, null))],
    ['stt', () => sttPOST(upload(wavBytes(), { provider: 'deepgram', model: 'nova-3' }, null))],
    ['sts', () => stsPOST(upload(wavBytes(), { provider: 'elevenlabs', model: 'eleven_multilingual_sts_v2', voice: 'abc' }, null, 'http://test/api/sts'))],
    ['preview', () => previewGET(new Request('http://test/api/voices/preview?provider=deepgram&voice=aura-2-thalia-en'))],
  ])('%s without a key is refused with 401 and never reaches the provider', async (_mode, call) => {
    mockFetch(() => new Response('never called'));
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toMatch(/Add your .+ API key/);
    expect(calls).toHaveLength(0);
  });

  it('ignores keys in the server environment and uses the caller’s key', async () => {
    mockFetch(() => new Response('ID3fake'));
    const res = await ttsPOST(json(EL_TTS));
    expect(res.status).toBe(200);
    expect(sentHeaders()['xi-api-key']).toBe(KEY);
    expect(JSON.stringify(sentHeaders())).not.toContain('server-env-key');
  });

  it('never echoes the key back, not in the body, headers or curl preview', async () => {
    mockFetch(() => new Response('ID3fake'));
    const res = await ttsPOST(json(EL_TTS));
    const everything = JSON.stringify([...res.headers.entries()]) + JSON.stringify(meta(res));
    expect(everything).not.toContain(KEY);
    expect(meta(res).request_preview).toContain('$API_KEY');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('turns a provider 401 into a clear "rejected your key" error the UI can act on', async () => {
    mockFetch(() => Response.json({ detail: { message: 'Invalid API key' } }, { status: 401 }));
    const res = await ttsPOST(json(EL_TTS));
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toMatch(/elevenlabs rejected your API key/);
  });

  it('strips the key from provider error text that echoes it', async () => {
    mockFetch(() => Response.json({ error: `Bad request for token ${KEY}` }, { status: 400 }));
    const res = await ttsPOST(json(EL_TTS));
    const body = await res.text();
    expect(res.status).toBe(400);
    expect(body).not.toContain(KEY);
    expect(body).toContain('***');
  });

  it('rejects an absurdly long key', async () => {
    const res = await ttsPOST(json(EL_TTS, 'x'.repeat(600)));
    expect(res.status).toBe(400);
  });
});

describe('/api/tts', () => {
  it('runs ElevenLabs end to end and returns audio bytes', async () => {
    mockFetch(() => new Response('ID3fake'));
    const res = await ttsPOST(json({ ...EL_TTS, voice_name: 'Rachel', params: { stability: 3, emotion: 'happy' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(await res.text()).toBe('ID3fake');

    expect(calls[0].url).toMatch(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/21m00Tcm4TlvDq8ikWAM/);
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.model_id).toBe('eleven_flash_v2_5');
    expect(sent.voice_settings.stability).toBe(1); // clamped
    expect(JSON.stringify(sent)).not.toContain('emotion'); // unsupported param never sent
    expect(meta(res)).toMatchObject({ mode: 'tts', provider: 'elevenlabs', provider_name: 'ElevenLabs', voice_name: 'Rachel', ext: 'mp3' });
  });

  it('turns other upstream errors into a 502 with the provider message', async () => {
    mockFetch(() => Response.json({ detail: 'model overloaded' }, { status: 500 }));
    const res = await ttsPOST(json(EL_TTS));
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toContain('model overloaded');
  });

  it('rejects a static voice that does not match the model', async () => {
    const res = await ttsPOST(json({ provider: 'deepgram', model: 'aura', voice: 'aura-2-thalia-en', text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('decodes Sarvam base64 audio', async () => {
    mockFetch(() => Response.json({ audios: [Buffer.from('RIFFfake').toString('base64')] }));
    const res = await ttsPOST(json({ provider: 'sarvam', model: 'bulbul:v2', voice: 'anushka', text: 'namaste' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/wav');
    expect(await res.text()).toBe('RIFFfake');
    expect(sentHeaders()['api-subscription-key']).toBe(KEY);
  });
});

describe('/api/stt', () => {
  it('parses Deepgram words and speakers', async () => {
    mockFetch(() => Response.json({
      results: { channels: [{ detected_language: 'en', alternatives: [{ transcript: 'hello world', words: [
        { word: 'hello', punctuated_word: 'Hello', start: 0.1, end: 0.4, speaker: 0 },
        { word: 'world', punctuated_word: 'world.', start: 0.5, end: 0.9, speaker: 0 },
      ] }] }] },
    }));
    const res = await sttPOST(upload(wavBytes(), {
      provider: 'deepgram', model: 'nova-3', params: { diarize: true, keyterm: 'Resonance, KeyValue' },
    }));
    expect(res.status).toBe(200);
    expect(sentHeaders().Authorization).toBe(`Token ${KEY}`);
    const url = calls[0].url;
    expect(url).toContain('model=nova-3');
    expect(url).toContain('diarize=true');
    expect(url.match(/keyterm=/g)).toHaveLength(2);
    const run: RunMeta = await res.json();
    expect(run.transcript!.text).toBe('hello world');
    expect(run.transcript!.language).toBe('en');
    expect(run.transcript!.words[0]).toEqual({ text: 'Hello', start: 0.1, end: 0.4, speaker: '0' });
    expect(JSON.stringify(run)).not.toContain(KEY);
  });

  it('rejects audio over the upload cap with 413', async () => {
    mockFetch(() => new Response('never called'));
    const res = await sttPOST(upload(new Uint8Array(MAX_UPLOAD_BYTES + 1), { provider: 'deepgram', model: 'nova-3' }));
    expect(res.status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it('rejects an empty upload', async () => {
    const res = await sttPOST(upload(new Uint8Array(0), { provider: 'deepgram', model: 'nova-3' }));
    expect(res.status).toBe(400);
  });
});

describe('voice lists and previews', () => {
  const ctx = (pid: string) => ({ params: Promise.resolve({ pid }) }) as never;

  it('without a key shows the built-in voices, cached only in the browser', async () => {
    mockFetch(() => new Response('never called'));
    const res = await voicesGET(new Request('http://test/api/providers/elevenlabs/voices?mode=tts'), ctx('elevenlabs'));
    const body = await res.json();
    expect(body.source).toBe('static');
    expect(body.voices.length).toBeGreaterThan(0);
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(calls).toHaveLength(0);
  });

  it('with a key loads the caller’s own voices and keeps them out of shared caches', async () => {
    mockFetch(() => Response.json({ voices: [{ voice_id: 'v1', name: 'Mine - cloned', labels: { accent: 'indian' }, preview_url: 'https://x/p.mp3' }] }));
    const res = await voicesGET(new Request('http://test/api/providers/elevenlabs/voices?mode=tts', { headers: withKey(KEY) }), ctx('elevenlabs'));
    const body = await res.json();
    expect(body).toMatchObject({ source: 'dynamic', voices: [{ id: 'v1', name: 'Mine', desc: 'Indian' }] });
    expect(sentHeaders()['xi-api-key']).toBe(KEY);
    expect(res.headers.get('Cache-Control')).toContain('private');
  });

  it('a preview spends the caller’s credits, so it is never cached by a shared CDN', async () => {
    mockFetch(() => new Response('audio'));
    const res = await previewGET(new Request('http://test/api/voices/preview?provider=deepgram&voice=aura-2-thalia-en', { headers: withKey(KEY) }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(res.headers.get('Cache-Control')).not.toContain('public');
  });
});
