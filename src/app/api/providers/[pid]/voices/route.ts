import { ProviderError } from '@/server/base';
import { get } from '@/server/registry';
import { handle } from '@/server/run';

export const dynamic = 'force-dynamic';

/** Voice lists change rarely; let the CDN keep them for 10 minutes instead of caching in the function. */
const CACHE = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' };

export function GET(req: Request, ctx: RouteContext<'/api/providers/[pid]/voices'>) {
  return handle(async () => {
    const { pid } = await ctx.params;
    const mode = new URL(req.url).searchParams.get('mode') ?? 'tts';
    const p = get(pid);
    const spec = p.mode(mode).voices ?? { source: 'static' as const, items: [] };
    const fallback = { source: 'static', voices: spec.items };
    if (spec.source !== 'dynamic' || !p.connected || !p.adapter.listVoices) return Response.json(fallback);
    try {
      const items = await p.adapter.listVoices(mode);
      if (!items.length) return Response.json(fallback);
      return Response.json({ source: 'dynamic', voices: items }, { headers: CACHE });
    } catch (e) {
      if (e instanceof ProviderError) return Response.json({ ...fallback, warning: e.message });
      throw e;
    }
  });
}
