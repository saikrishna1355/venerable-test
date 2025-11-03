export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getStore } from '@/lib/store';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const store = getStore();
  return Response.json({ rules: store.listRules() });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req.headers)) return new Response('Unauthorized', { status: 401 });
  const store = getStore();
  const body = await req.json();
  const added = store.addRule({ ...(body as any) });
  return Response.json(added);
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req.headers)) return new Response('Unauthorized', { status: 401 });
  const store = getStore();
  const body = await req.json();
  const { id, ...patch } = body as any;
  const updated = store.updateRule(id, patch);
  if (!updated) return new Response('Not found', { status: 404 });
  return Response.json(updated);
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req.headers)) return new Response('Unauthorized', { status: 401 });
  const store = getStore();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Bad request', { status: 400 });
  const ok = store.removeRule(id);
  return Response.json({ ok });
}

