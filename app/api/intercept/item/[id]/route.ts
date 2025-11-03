export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { interceptStore } from '@/lib/interceptStore';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = interceptStore();
  const item = s.get(id);
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json(item);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const s = interceptStore();
  if (body?.action === 'send') {
    const ok = s.send(id, { url: body.url, method: body.method, headers: body.headers, body: body.body, responseStatus: body.responseStatus, responseHeaders: body.responseHeaders, responseBody: body.responseBody });
    if (!ok) return new Response('Not found', { status: 404 });
    return Response.json({ ok: true });
  } else if (body?.action === 'drop') {
    const ok = s.drop(id);
    if (!ok) return new Response('Not found', { status: 404 });
    return Response.json({ ok: true });
  }
  return new Response('Bad request', { status: 400 });
}
