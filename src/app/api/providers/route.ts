import { providers } from '@/server/registry';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(providers.map((p) => p.public()));
}
