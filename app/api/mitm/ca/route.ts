export const runtime = 'nodejs';

import fs from 'fs';
import path from 'path';

function findCAPath(): string | null {
  const caDir = path.join(process.cwd(), 'data', 'mitm-ca');
  const candidates = [
    path.join(caDir, 'ca.pem'),
    path.join(caDir, 'certs', 'ca.pem'),
    path.join(caDir, 'rootCA.pem'),
    path.join(caDir, 'rootCA.crt'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

export async function GET() {
  const p = findCAPath();
  if (!p) return new Response('CA not found. Start the MITM proxy to generate it (npm run proxy:mitm).', { status: 404 });
  const buf = fs.readFileSync(p);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/x-pem-file',
      'Content-Disposition': 'attachment; filename="seclab-root-ca.pem"',
      'Cache-Control': 'no-cache',
    },
  });
}

