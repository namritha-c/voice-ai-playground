import type { Word } from '@/api/client';
import { curlPreview, key, ProviderError, request, type ProviderAdapter } from '../../base';

const ID = 'deepgram';
const BASE = 'https://api.deepgram.com/v1';
const ENC: Record<string, [Record<string, string>, string, string]> = {
  mp3: [{ encoding: 'mp3' }, 'audio/mpeg', 'mp3'],
  linear16: [{ encoding: 'linear16', container: 'wav', sample_rate: '24000' }, 'audio/wav', 'wav'],
  opus: [{ encoding: 'opus', container: 'ogg' }, 'audio/ogg', 'ogg'],
  flac: [{ encoding: 'flac' }, 'audio/flac', 'flac'],
};

const h = () => ({ Authorization: `Token ${key('DEEPGRAM_API_KEY')}` });

export const adapter: ProviderAdapter = {
  async tts(req) {
    if (!req.voice) throw new ProviderError('pick a voice', 400);
    const [q, mime, ext] = ENC[String(req.params.encoding ?? 'mp3')];
    // Deepgram addresses TTS by voice model id, e.g. aura-2-thalia-en
    const url = `${BASE}/speak?${new URLSearchParams({ model: req.voice, ...q })}`;
    const headers = { ...h(), 'Content-Type': 'application/json' };
    const body = { text: req.text };
    const r = await request(ID, url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { audio: r.body, mime, ext, metric_ms: r.ttfb_ms, request_preview: curlPreview('POST', url, { headers, json: body }) };
  },

  async stt(req) {
    const p = req.params;
    const qs = new URLSearchParams({ model: req.model, language: String(p.language ?? 'multi') });
    for (const k of ['smart_format', 'punctuate', 'diarize', 'filler_words']) if (k in p) qs.set(k, String(p[k]));
    for (const term of String(p.keyterm ?? '').split(',').map((t) => t.trim()).filter(Boolean)) qs.append('keyterm', term);
    const url = `${BASE}/listen?${qs}`;
    const headers = { ...h(), 'Content-Type': req.mime };
    const r = await request(ID, url, { method: 'POST', headers, body: req.audio as BodyInit });
    const ch = r.json().results.channels[0];
    const alt = ch.alternatives[0];
    const words: Word[] = (alt.words ?? []).map((w: { word: string; punctuated_word?: string; start?: number; end?: number; speaker?: number | null }) => ({
      text: w.punctuated_word || w.word, start: w.start ?? null, end: w.end ?? null, speaker: w.speaker == null ? null : String(w.speaker),
    }));
    return {
      text: alt.transcript ?? '', metric_ms: r.total_ms, words, language: ch.detected_language ?? null,
      request_preview: curlPreview('POST', url, { headers, dataNote: '@audio.wav' }),
    };
  },
};
