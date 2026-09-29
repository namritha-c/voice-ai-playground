import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Provider, RunMeta } from '@/api/client';
import { GET as providersGET } from '@/app/api/providers/route';
import { POST as sttPOST } from '@/app/api/stt/route';
import { POST as ttsPOST } from '@/app/api/tts/route';
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

const json = (body: unknown) => new Request('http://test/api/tts', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

function upload(audio: Uint8Array, cfg: unknown) {
  const f = new FormData();
  f.append('audio', new Blob([audio as BlobPart], { type: 'audio/wav' }), 'a.wav');
  f.append('config', JSON.stringify(cfg));
  return new Request('http://test/api/stt', { method: 'POST', body: f });
}

const meta = (res: Response): RunMeta => JSON.parse(Buffer.from(res.headers.get('X-Resonance-Meta')!, 'base64').toString());

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_KEY', 'el-test');
  vi.stubEnv('DEEPGRAM_API_KEY', 'dg-test');
  vi.stubEnv('SARVAM_API_KEY', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('/api/providers', () => {
  it('lists the three providers in order and never leaks a key', async () => {
    const res = providersGET();
    const text = await res.text();
    const list: Provider[] = JSON.parse(text);
    expect(list.map((p) => p.id)).toEqual(['elevenlabs', 'deepgram', 'sarvam']);
    const by = Object.fromEntries(list.map((p) => [p.id, p]));
    expect(by.elevenlabs.connected).toBe(true);
    expect(by.sarvam.connected).toBe(false);
    expect(by.sarvam.missing_env).toEqual(['SARVAM_API_KEY']);
    expect(by.deepgram.caps).toEqual(['tts', 'stt']);
    expect(text).not.toContain('el-test');
  });
});

describe('/api/tts', () => {
  it('rejects a provider with no key and names the variable', async () => {
    const res = await ttsPOST(json({ provider: 'sarvam', model: 'bulbul:v2', voice: 'anushka', text: 'hi' }));
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toContain('SARVAM_API_KEY');
  });

  it('runs ElevenLabs end to end and returns audio bytes', async () => {
    mockFetch(() => new Response('ID3fake'));
    const res = await ttsPOST(json({
      provider: 'elevenlabs', model: 'eleven_flash_v2_5', voice: '21m00Tcm4TlvDq8ikWAM', voice_name: 'Rachel',
      text: 'Hello there', params: { stability: 3, emotion: 'happy' },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(await res.text()).toBe('ID3fake');

    const { url, init } = calls[0];
    expect(url).toMatch(/^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/21m00Tcm4TlvDq8ikWAM/);
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('el-test');
    const sent = JSON.parse(String(init.body));
    expect(sent.model_id).toBe('eleven_flash_v2_5');
    expect(sent.voice_settings.stability).toBe(1); // clamped
    expect(JSON.stringify(sent)).not.toContain('emotion'); // unsupported param never sent

    const m = meta(res);
    expect(m).toMatchObject({ mode: 'tts', provider: 'elevenlabs', provider_name: 'ElevenLabs', voice_name: 'Rachel', ext: 'mp3' });
    expect(m.request_preview).toContain('$API_KEY');
    expect(m.request_preview).not.toContain('el-test');
  });

  it('turns an upstream error into a 502 with the provider message', async () => {
    mockFetch(() => Response.json({ detail: { message: 'Invalid API key' } }, { status: 401 }));
    const res = await ttsPOST(json({ provider: 'elevenlabs', model: 'eleven_flash_v2_5', voice: 'abc', text: 'hi' }));
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toContain('Invalid API key');
  });

  it('rejects a static voice that does not match the model', async () => {
    const res = await ttsPOST(json({ provider: 'deepgram', model: 'aura', voice: 'aura-2-thalia-en', text: 'hi' }));
    expect(res.status).toBe(400);
  });

  it('decodes Sarvam base64 audio', async () => {
    vi.stubEnv('SARVAM_API_KEY', 'sv-test');
    mockFetch(() => Response.json({ audios: [Buffer.from('RIFFfake').toString('base64')] }));
    const res = await ttsPOST(json({ provider: 'sarvam', model: 'bulbul:v2', voice: 'anushka', text: 'namaste' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/wav');
    expect(await res.text()).toBe('RIFFfake');
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
    const url = calls[0].url;
    expect(url).toContain('model=nova-3');
    expect(url).toContain('diarize=true');
    expect(url.match(/keyterm=/g)).toHaveLength(2);
    const run: RunMeta = await res.json();
    expect(run.transcript!.text).toBe('hello world');
    expect(run.transcript!.language).toBe('en');
    expect(run.transcript!.words[0]).toEqual({ text: 'Hello', start: 0.1, end: 0.4, speaker: '0' });
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
