export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { interceptStore } from '@/lib/interceptStore';

export async function POST(req: NextRequest) {
  const s = interceptStore();
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return new Response('Bad request', { status: 400 });
  s.addResponseWatch(url);
  return Response.json({ ok: true });
}

