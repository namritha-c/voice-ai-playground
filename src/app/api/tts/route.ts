import { ProviderError } from '@/server/base';
import { audioResponse, handle, newId, prepare, readJson } from '@/server/run';

export const maxDuration = 60;

export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    if (typeof body.text !== 'string' || !body.text) throw new ProviderError('text is required', 400);
    const { p, spec, voice, params } = prepare('tts', body.provider, body.model, body.voice, body.params);
    const limit = spec.max_chars ?? 5000;
    if (body.text.length > limit) throw new ProviderError(`text is longer than ${limit} characters`, 400);
    const res = await p.adapter.tts!({ model: body.model, voice, text: body.text, params });
    return audioResponse(res, {
      id: newId(), mode: 'tts', provider: p.id, provider_name: p.name, model: body.model,
      voice, voice_name: body.voice_name ?? null, params, transcript: null,
    });
  });
}
