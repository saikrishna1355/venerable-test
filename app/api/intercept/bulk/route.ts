export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { interceptStore } from '@/lib/interceptStore';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: 'sendAll' | 'dropAll' };
  const s = interceptStore();
  const items = s.list();
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ ok: true, affected: 0 });
  }
  let count = 0;
  if (body.action === 'dropAll') {
    for (const it of items) {
      if (s.drop(it.id)) count++;
    }
    return Response.json({ ok: true, action: 'dropAll', affected: count });
  }
  // Default to sendAll
  for (const it of items) {
    if (s.send(it.id, {})) count++;
  }
  return Response.json({ ok: true, action: 'sendAll', affected: count });
}

