export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { repeaterDrafts } from '@/lib/repeaterDrafts';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  if (!body || !body.method || !body.url) return new Response('Bad request', { status: 400 });
  const store = repeaterDrafts();
  const draft = store.create({ method: body.method, url: body.url, headers: body.headers || {}, body: body.body });
  return Response.json({ id: draft.id });
}

