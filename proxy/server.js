#!/usr/bin/env node
/* Simple forward proxy with basic response header modification for HTTP only. */
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PROXY_PORT ? Number(process.env.PROXY_PORT) : 8080;
const dataDir = path.join(process.cwd(), 'data');
const flowsFile = path.join(dataDir, 'flows.json');
const rulesFile = path.join(dataDir, 'rules.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}
function recordFlow(flow) {
  const flows = readJson(flowsFile, []);
  flows.push(flow);
  writeJson(flowsFile, flows);
}
function matchRules(host, pathName) {
  const rules = readJson(rulesFile, []);
  return rules.filter((r) => r.enabled && host.includes(r.hostPattern) && (!r.pathPattern || pathName.includes(r.pathPattern)));
}
function applyHeaderRules(headers, rules) {
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(), Array.isArray(v)?v.join(', '):String(v||'')])) };
  for (const r of rules) {
    const act = r.actions || {};
    if (act.stripCSP) delete h['content-security-policy'];
    if (act.stripXFO) delete h['x-frame-options'];
    if (act.injectCSP) h['content-security-policy'] = act.injectCSP;
    if (act.removeHeaders) for (const k of act.removeHeaders) delete h[k.toLowerCase()];
    if (act.addHeaders) for (const [k,v] of Object.entries(act.addHeaders)) h[k.toLowerCase()] = v;
  }
  return h;
}

const server = http.createServer((clientReq, clientRes) => {
  // clientReq.url is absolute-form for proxies (e.g., http://example.com/path)
  const targetUrl = new URL(clientReq.url);
  const isHttps = targetUrl.protocol === 'https:';
  const opts = {
    method: clientReq.method,
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    headers: { ...clientReq.headers, host: targetUrl.host },
  };
  const proxyClient = (isHttps ? https : http).request(opts, (remoteRes) => {
    const chunks = [];
    remoteRes.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    remoteRes.on('end', () => {
      const body = Buffer.concat(chunks);
      const rules = matchRules(targetUrl.hostname, targetUrl.pathname);
      const mHeaders = applyHeaderRules(remoteRes.headers, rules);
      clientRes.writeHead(remoteRes.statusCode || 502, mHeaders);
      clientRes.end(body);
      // record flow (preview only)
      try {
        const isPreflight = clientReq.method === 'OPTIONS' && (
          clientReq.headers['access-control-request-method'] || clientReq.headers['Access-Control-Request-Method']
        );
        if (isPreflight) return; // don't record preflight
        recordFlow({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now(),
          method: clientReq.method,
          url: targetUrl.toString(),
          requestHeaders: Object.fromEntries(Object.entries(clientReq.headers).map(([k,v])=>[k, Array.isArray(v)?v.join(', '):String(v||'') ])),
          responseStatus: remoteRes.statusCode,
          responseHeaders: Object.fromEntries(Object.entries(mHeaders).map(([k,v])=>[k, Array.isArray(v)?v.join(', '):String(v||'') ])),
          responseBodyPreview: body.toString('utf8').slice(0, 4096),
          source: 'forward-proxy',
        });
      } catch {}
    });
  });
  proxyClient.on('error', (err) => {
    clientRes.writeHead(502);
    clientRes.end('Proxy error: ' + err.message);
  });
  clientReq.pipe(proxyClient);
});

server.on('connect', (req, clientSocket, head) => {
  // HTTPS CONNECT tunneling (no header modification)
  const [host, portStr] = req.url.split(':');
  const port = parseInt(portStr, 10) || 443;
  const serverSocket = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  serverSocket.on('error', () => clientSocket.destroy());
});

server.listen(PORT, () => {
  console.log(`[forward-proxy] listening on ${PORT}`);
});
