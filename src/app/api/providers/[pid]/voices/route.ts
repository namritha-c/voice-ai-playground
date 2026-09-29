import { ProviderError } from '@/server/base';
import { get } from '@/server/registry';
import { handle, KEY_HEADER } from '@/server/run';

export const dynamic = 'force-dynamic';

/** A voice list can include the caller's private and cloned voices, so only their browser may cache it. */
const PRIVATE = { 'Cache-Control': 'private, max-age=600' };

export function GET(req: Request, ctx: RouteContext<'/api/providers/[pid]/voices'>) {
  return handle(async () => {
    const { pid } = await ctx.params;
    const mode = new URL(req.url).searchParams.get('mode') ?? 'tts';
    const p = get(pid);
    const spec = p.mode(mode).voices ?? { source: 'static' as const, items: [] };
    const fallback = { source: 'static', voices: spec.items };
    const key = req.headers.get(KEY_HEADER)?.trim();
    // Without a key, show the built-in voices; the page asks for a key before it generates anything.
    if (spec.source !== 'dynamic' || !key || !p.adapter.listVoices) return Response.json(fallback, { headers: PRIVATE });
    try {
      const items = await p.adapter.listVoices(mode, key);
      if (!items.length) return Response.json(fallback, { headers: PRIVATE });
      return Response.json({ source: 'dynamic', voices: items }, { headers: PRIVATE });
    } catch (e) {
      if (e instanceof ProviderError) return Response.json({ ...fallback, warning: e.message }, { headers: PRIVATE });
      throw e;
    }
  });
}
