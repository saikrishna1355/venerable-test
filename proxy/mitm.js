#!/usr/bin/env node
// Minimal MITM proxy using http-mitm-proxy.
// - HTTP and HTTPS (via CONNECT) are intercepted.
// - Responses are recorded to data/flows.json (preview only).
// - Optional response header rules are applied (strip CSP/XFO, inject CSP).
// NOTE: For HTTPS interception, trust the generated CA in data/mitm-ca.

const Proxy = require('http-mitm-proxy');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const flowsFile = path.join(dataDir, 'flows.json');
const rulesFile = path.join(dataDir, 'rules.json');
const caDir = path.join(dataDir, 'mitm-ca');
const PORT = process.env.MITM_PORT ? Number(process.env.MITM_PORT) : 8081;

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, data) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

function recordFlow(flow) {
  const flows = readJson(flowsFile, []);
  flows.push(flow);
  writeJson(flowsFile, flows);
}

function matchRules(host, pathname) {
  const rules = readJson(rulesFile, []);
  return rules.filter((r) => r.enabled && host.includes(r.hostPattern) && (!r.pathPattern || pathname.includes(r.pathPattern)));
}

function applyHeaderRules(headers, rules) {
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v || '')])) };
  for (const r of rules) {
    const a = r.actions || {};
    if (a.stripCSP) delete h['content-security-policy'];
    if (a.stripXFO) delete h['x-frame-options'];
    if (a.injectCSP) h['content-security-policy'] = a.injectCSP;
    if (a.removeHeaders) for (const k of a.removeHeaders) delete h[k.toLowerCase()];
    if (a.addHeaders) for (const [k, v] of Object.entries(a.addHeaders)) h[k.toLowerCase()] = v;
  }
  return h;
}

ensureDir(dataDir);
ensureDir(caDir);

const proxy = Proxy();

proxy.onError((ctx, err) => {
  console.error('[mitm] error:', err && err.message ? err.message : err);
});

proxy.onConnect((req, socket) => {
  // CONNECT for HTTPS will be handled; nothing to do here except log if needed.
});

proxy.onRequest(function onRequest(ctx, callback) {
  try {
    ctx.use(Proxy.gunzip);
  } catch {}

  const startedAt = Date.now();
  const reqChunks = [];
  ctx.onRequestData((ctx2, chunk, cb) => { if (chunk) reqChunks.push(Buffer.from(chunk)); cb(); });

  const host = (ctx.clientToProxyRequest.headers.host || '').split(':')[0] || '';
  let pathname = '/';
  try { const u = new URL(ctx.clientToProxyRequest.url, `http://${host}`); pathname = u.pathname; } catch {}
  const rules = matchRules(host, pathname);
  const isPreflight = ctx.clientToProxyRequest.method === 'OPTIONS' && (
    ctx.clientToProxyRequest.headers['access-control-request-method'] ||
    ctx.clientToProxyRequest.headers['Access-Control-Request-Method']
  );

  // Modify response headers when they arrive
  ctx.onResponseHeaders((ctx3, cb) => {
    try {
      const modified = applyHeaderRules(ctx3.serverToProxyResponse.headers || {}, rules);
      ctx3.serverToProxyResponse.headers = modified;
    } catch {}
    cb();
  });

  const respChunks = [];
  ctx.onResponseData((ctx4, chunk, cb) => { if (chunk) respChunks.push(Buffer.from(chunk)); cb(); });
  ctx.onResponseEnd((ctx5, cb) => {
    try {
      if (isPreflight) return cb();
      const reqBody = Buffer.concat(reqChunks).toString('utf8');
      const respBody = Buffer.concat(respChunks);
      const url = `${ctx5.isSSL ? 'https' : 'http'}://${host}${ctx5.clientToProxyRequest.url}`;
      const flow = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: startedAt,
        method: ctx5.clientToProxyRequest.method,
        url,
        requestHeaders: Object.fromEntries(Object.entries(ctx5.clientToProxyRequest.headers || {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v || '')])),
        requestBody: reqBody,
        responseStatus: ctx5.serverToProxyResponse.statusCode,
        responseHeaders: Object.fromEntries(Object.entries(ctx5.serverToProxyResponse.headers || {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v || '')])),
        responseBodyPreview: respBody.toString('utf8').slice(0, 4096),
        source: 'mitm-proxy',
      };
      recordFlow(flow);
    } catch {}
    cb();
  });

  return callback();
});

proxy.listen({
  port: PORT,
  sslCaDir: caDir,
}, () => {
  const caCandidates = [
    path.join(caDir, 'ca.pem'),
    path.join(caDir, 'certs', 'ca.pem'),
    path.join(caDir, 'rootCA.pem'),
  ];
  const existing = caCandidates.find((p) => fs.existsSync(p));
  console.log(`[mitm] listening on ${PORT}`);
  if (existing) console.log(`[mitm] CA at: ${existing}`);
  else console.log(`[mitm] CA will be generated under: ${caDir}. Import and trust it to intercept HTTPS.`);
});
