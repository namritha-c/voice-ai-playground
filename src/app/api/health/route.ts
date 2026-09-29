import { providers } from '@/server/registry';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true, providers: Object.fromEntries(providers.map((p) => [p.id, p.connected])) });
}
