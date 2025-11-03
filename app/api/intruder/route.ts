export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { httpRequest } from '@/lib/httpClient';
import { getStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  const { url, method, headers, bodyTemplate, payloads } = (await req.json()) as {
    url: string;
    method: string;
    headers?: Record<string, string>;
    bodyTemplate?: string; // use § placeholders
    payloads: string[];
  };
  if (!url || !method || !Array.isArray(payloads)) return new Response('Bad request', { status: 400 });
  const store = getStore();
  const results: Array<{ index: number; status: number; length: number }> = [];
  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    const tUrl = url.split('§').join(p);
    const tBody = (bodyTemplate || '').split('§').join(p);
    try {
      const resp = await httpRequest(method, tUrl, headers || {}, tBody ? Buffer.from(tBody) : undefined);
      store.recordFlow({
        method,
        url: tUrl,
        requestHeaders: headers || {},
        requestBody: tBody,
        responseStatus: resp.status,
        responseHeaders: resp.headers,
        responseBodyPreview: resp.body.toString('utf8').slice(0, 4096),
        source: 'scanner',
      });
      results.push({ index: i, status: resp.status, length: resp.body.length });
    } catch (e) {
      results.push({ index: i, status: 0, length: 0 });
    }
  }
  return Response.json({ results });
}

