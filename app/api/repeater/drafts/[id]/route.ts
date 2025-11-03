export const runtime = 'nodejs';

import { repeaterDrafts } from '@/lib/repeaterDrafts';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = repeaterDrafts();
  const draft = store.get(id);
  if (!draft) return new Response('Not found', { status: 404 });
  return Response.json(draft);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = repeaterDrafts();
  return Response.json({ ok: store.delete(id) });
}

