export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { interceptStore } from '@/lib/interceptStore';

export async function GET() {
  const s = interceptStore();
  return Response.json({
    requestsEnabled: s.isEnabled(),
    responsesEnabled: typeof (s as any).isResponsesEnabled === 'function' ? (s as any).isResponsesEnabled() : false,
  });
}

export async function POST(req: NextRequest) {
  const s = interceptStore();
  const body = (await req.json().catch(() => ({}))) as {
    requestsEnabled?: boolean;
    responsesEnabled?: boolean;
    addWatchUrl?: string;
  };
  if (typeof body.requestsEnabled === 'boolean') s.setEnabled(body.requestsEnabled);
  if (typeof body.responsesEnabled === 'boolean') s.setResponsesEnabled(body.responsesEnabled);
  if (body.addWatchUrl) s.addResponseWatch(body.addWatchUrl);
  return Response.json({
    requestsEnabled: s.isEnabled(),
    responsesEnabled: s.isResponsesEnabled(),
  });
}
