import type { Voice, Word } from '@/api/types';
import { pcm16ToWav } from '../../audio';
import { curlPreview, ProviderError, request, toForm, type ProviderAdapter } from '../../base';

const ID = 'elevenlabs';
const BASE = 'https://api.elevenlabs.io/v1';

const h = (key: string) => ({ 'xi-api-key': key });

function pick(p: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in p).map((k) => [k, p[k]]));
}

function audio(body: Uint8Array, fmt: string) {
  if (fmt.startsWith('pcm_')) return { audio: pcm16ToWav(body, Number(fmt.split('_')[1])), mime: 'audio/wav', ext: 'wav' };
  return { audio: body, mime: 'audio/mpeg', ext: 'mp3' };
}

export const adapter: ProviderAdapter = {
  async tts(req) {
    if (!req.voice) throw new ProviderError('pick a voice', 400);
    const p = req.params;
    const fmt = String(p.output_format ?? 'mp3_44100_128');
    const url = `${BASE}/text-to-speech/${req.voice}?output_format=${fmt}`;
    const body = {
      text: req.text,
      model_id: req.model,
      voice_settings: pick(p, ['stability', 'similarity_boost', 'style', 'speed', 'use_speaker_boost']),
    };
    const headers = { ...h(req.key), 'Content-Type': 'application/json' };
    const r = await request(ID, url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { ...audio(r.body, fmt), metric_ms: r.ttfb_ms, request_preview: curlPreview('POST', url, { headers, json: body }) };
  },

  async stt(req) {
    const p = req.params;
    const form: Record<string, string> = {
      model_id: req.model,
      diarize: String(p.diarize ?? false),
      tag_audio_events: String(p.tag_audio_events ?? true),
    };
    if (p.language_code != null && p.language_code !== 'auto') form.language_code = String(p.language_code);
    const url = `${BASE}/speech-to-text`;
    const r = await request(ID, url, {
      method: 'POST', headers: h(req.key), body: toForm(form, { field: 'file', name: 'audio.wav', data: req.audio, mime: req.mime }),
    });
    const d = r.json();
    const words: Word[] = (d.words ?? [])
      .filter((w: { type?: string }) => (w.type ?? 'word') !== 'spacing')
      .map((w: { text: string; start?: number; end?: number; speaker_id?: string }) =>
        ({ text: w.text, start: w.start ?? null, end: w.end ?? null, speaker: w.speaker_id ?? null }));
    return {
      text: d.text ?? '', metric_ms: r.total_ms, words, language: d.language_code ?? null,
      request_preview: curlPreview('POST', url, { headers: h(req.key), form: { ...form, file: '@audio.wav' } }),
    };
  },

  async sts(req) {
    if (!req.voice) throw new ProviderError('pick a target voice', 400);
    const p = req.params;
    const url = `${BASE}/speech-to-speech/${req.voice}?output_format=mp3_44100_128`;
    const form = {
      model_id: req.model,
      voice_settings: JSON.stringify(pick(p, ['stability', 'similarity_boost'])),
      remove_background_noise: String(p.remove_background_noise ?? false),
    };
    const r = await request(ID, url, {
      method: 'POST', headers: h(req.key), body: toForm(form, { field: 'audio', name: 'source.wav', data: req.audio, mime: req.mime }),
    });
    return {
      audio: r.body, mime: 'audio/mpeg', ext: 'mp3', metric_ms: r.ttfb_ms,
      request_preview: curlPreview('POST', url, { headers: h(req.key), form: { ...form, audio: '@source.wav' } }),
    };
  },

  async listVoices(_mode, key) {
    const r = await request(ID, `${BASE}/voices`, { headers: h(key) });
    const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
    return (r.json().voices ?? []).map((v: {
      voice_id: string; name: string; category?: string; preview_url?: string | null; labels?: Record<string, string>;
    }): Voice => {
      const lb = v.labels ?? {};
      const desc = [lb.description || lb.descriptive, lb.use_case || lb.accent].filter(Boolean).map((x) => title(x!)).join(' · ');
      return { id: v.voice_id, name: v.name.split(' - ')[0], desc: desc || v.category || '', preview_url: v.preview_url ?? null };
    });
  },
};
