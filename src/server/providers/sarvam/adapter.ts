import type { Word } from '@/api/types';
import { curlPreview, ProviderError, request, toForm, type ProviderAdapter } from '../../base';

const ID = 'sarvam';
const BASE = 'https://api.sarvam.ai';

const h = (key: string) => ({ 'api-subscription-key': key });

export const adapter: ProviderAdapter = {
  async tts(req) {
    const p = req.params;
    const body = {
      text: req.text,
      model: req.model,
      speaker: req.voice || 'anushka',
      target_language_code: p.target_language_code ?? 'en-IN',
      ...Object.fromEntries(['pace', 'pitch', 'loudness', 'enable_preprocessing'].filter((k) => k in p).map((k) => [k, p[k]])),
    };
    const url = `${BASE}/text-to-speech`;
    const headers = { ...h(req.key), 'Content-Type': 'application/json' };
    const r = await request(ID, url, { method: 'POST', headers, body: JSON.stringify(body) });
    const audios: string[] = r.json().audios ?? [];
    if (!audios.length) throw new ProviderError('sarvam returned no audio');
    return {
      audio: new Uint8Array(Buffer.from(audios[0], 'base64')), mime: 'audio/wav', ext: 'wav', metric_ms: r.total_ms,
      request_preview: curlPreview('POST', url, { headers, json: body }),
    };
  },

  async stt(req) {
    const p = req.params;
    const form = {
      model: req.model,
      language_code: String(p.language_code ?? 'unknown'),
      with_timestamps: String(p.with_timestamps ?? false),
    };
    const url = `${BASE}/speech-to-text`;
    const r = await request(ID, url, {
      method: 'POST', headers: h(req.key), body: toForm(form, { field: 'file', name: 'audio.wav', data: req.audio, mime: req.mime }),
    });
    const d = r.json();
    const ts = d.timestamps ?? {};
    const w: string[] = ts.words ?? [], s: number[] = ts.start_time_seconds ?? [], e: number[] = ts.end_time_seconds ?? [];
    const words: Word[] = w.slice(0, Math.min(w.length, s.length, e.length)).map((text, i) => ({ text, start: s[i], end: e[i], speaker: null }));
    return {
      text: d.transcript ?? '', metric_ms: r.total_ms, words, language: d.language_code ?? null,
      request_preview: curlPreview('POST', url, { headers: h(req.key), form: { ...form, file: '@audio.wav' } }),
    };
  },
};
