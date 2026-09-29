import { ProviderError } from '@/server/base';
import { get } from '@/server/registry';
import { apiKey, handle, prepare } from '@/server/run';

export const maxDuration = 60;

const PREVIEW_TEXT = "Hi, I'm {name}. This is how I sound.";

/** Speak a short line in the given voice. It spends the caller's credits, so only their browser may cache it (never a shared CDN). */
export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const pid = q.get('provider'), voiceId = q.get('voice');
    if (!pid || !voiceId) throw new ProviderError('provider and voice are required', 400);
    const p = get(pid);
    const model = p.mode('tts').models[0];
    const { voice, params } = prepare('tts', p.id, model, voiceId, {});
    const text = PREVIEW_TEXT.replace('{name}', q.get('name') || 'your new voice');
    const res = await p.adapter.tts!({ key: apiKey(req, p), model, voice, text, params });
    return new Response(res.audio as BodyInit, {
      headers: { 'Content-Type': res.mime, 'Cache-Control': 'private, max-age=86400, immutable' },
    });
  });
}
