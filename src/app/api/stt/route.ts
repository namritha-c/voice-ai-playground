import type { RunMeta } from '@/api/client';
import { handle, newId, prepare, readUpload } from '@/server/run';

export const maxDuration = 60;

export function POST(req: Request) {
  return handle(async () => {
    const { cfg, audio, mime } = await readUpload(req);
    const { p, params } = prepare('stt', cfg.provider, cfg.model, null, cfg.params);
    const res = await p.adapter.stt!({ model: cfg.model, audio, mime, params });
    const run: RunMeta = {
      id: newId(), mode: 'stt', provider: p.id, provider_name: p.name, model: cfg.model, voice: null, voice_name: null, params,
      transcript: { text: res.text, language: res.language, words: res.words },
      ext: null, metric_ms: res.metric_ms, request_preview: res.request_preview,
    };
    return Response.json(run);
  });
}
