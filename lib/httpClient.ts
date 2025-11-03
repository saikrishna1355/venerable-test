import http from 'http';
import https from 'https';
import { URL } from 'url';
import { HeaderMap } from './types';

export type HttpResponse = {
  status: number;
  headers: HeaderMap;
  body: Buffer;
};

export async function httpRequest(
  method: string,
  urlStr: string,
  headers: HeaderMap = {},
  body?: Buffer
): Promise<HttpResponse> {
  const url = new URL(urlStr);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  return new Promise<HttpResponse>((resolve, reject) => {
    const req = client.request(
      {
        method,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const respHeaders: HeaderMap = {};
          Object.entries(res.headers).forEach(([k, v]) => {
            if (Array.isArray(v)) respHeaders[k] = v.join(', ');
            else if (typeof v === 'string') respHeaders[k] = v;
          });
          resolve({ status: res.statusCode || 0, headers: respHeaders, body: buf });
        });
      }
    );
    req.on('error', reject);
    if (body && body.length > 0) req.write(body);
    req.end();
  });
}

