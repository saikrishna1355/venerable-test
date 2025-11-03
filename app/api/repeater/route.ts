export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { httpRequest } from '@/lib/httpClient';
import { getStore } from '@/lib/store';
import { runOnResponse } from '@/lib/plugins';

export async function POST(req: NextRequest) {
  const store = getStore();
  const { method, url, headers, body } = (await req.json()) as {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  if (!method || !url) return new Response('Bad request', { status: 400 });

  try {
    const resp = await httpRequest(method, url, headers || {}, body ? Buffer.from(body) : undefined);
    const flow = store.recordFlow({
      method,
      url,
      requestHeaders: headers || {},
      requestBody: body,
      responseStatus: resp.status,
      responseHeaders: resp.headers,
      responseBodyPreview: resp.body.toString('utf8').slice(0, 4096),
      source: 'repeater',
    });
    runOnResponse(flow);
    return Response.json({
      status: resp.status,
      headers: resp.headers,
      body: resp.body.toString('utf8'),
      flowId: flow.id,
    });
  } catch (e: any) {
    return new Response(`Request error: ${e?.message || 'unknown'}`, { status: 502 });
  }
}
