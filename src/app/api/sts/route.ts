import { audioResponse, handle, newId, prepare, readUpload } from '@/server/run';

export const maxDuration = 60;

export function POST(req: Request) {
  return handle(async () => {
    const { cfg, audio, mime } = await readUpload(req);
    const { p, voice, params } = prepare('sts', cfg.provider, cfg.model, cfg.voice, cfg.params);
    const res = await p.adapter.sts!({ model: cfg.model, voice, audio, mime, params });
    return audioResponse(res, {
      id: newId(), mode: 'sts', provider: p.id, provider_name: p.name, model: cfg.model,
      voice, voice_name: cfg.voice_name ?? null, params, transcript: null,
    });
  });
}
