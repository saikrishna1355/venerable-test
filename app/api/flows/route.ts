export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const store = getStore();
  const flows = store.listFlows();
  return Response.json({ flows });
}

