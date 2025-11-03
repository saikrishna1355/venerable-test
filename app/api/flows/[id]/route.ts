export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = getStore();
  const flow = store.getFlow(id);
  if (!flow) return new Response('Not found', { status: 404 });
  return Response.json({ flow });
}
