export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { interceptStore } from '@/lib/interceptStore';

export async function GET() {
  const s = interceptStore();
  return Response.json({ enabled: s.isEnabled() });
}

export async function POST(req: NextRequest) {
  const s = interceptStore();
  const { enabled } = (await req.json()) as { enabled: boolean };
  s.setEnabled(!!enabled);
  return Response.json({ enabled: s.isEnabled() });
}

