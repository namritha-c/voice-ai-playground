import { providers } from '@/server/registry';

/** Public catalogue: no per-user data, so the CDN may cache it. */
export function GET() {
  return Response.json(providers.map((p) => p.public()), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
