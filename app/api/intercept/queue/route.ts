export const runtime = 'nodejs';

import { interceptStore } from '@/lib/interceptStore';

export async function GET() {
  const s = interceptStore();
  return Response.json({ enabled: s.isEnabled(), items: s.list() });
}

