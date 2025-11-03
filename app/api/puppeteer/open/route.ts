export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { getStore } from '@/lib/store';
import { interceptStore } from '@/lib/interceptStore';

type LaunchReq = {
  url: string;
  viaProxy?: boolean;
  bypassCSP?: boolean;
  headless?: boolean;
  devtools?: boolean;
  chromiumOnly?: boolean;
  fallbackDirect?: boolean; // if proxy nav fails, retry without proxy
};

function isHttpUrl(u: string) {
  try {
    const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:';
  } catch { return false; }
}

function resolveOnPath(cmd: string): string | null {
  const PATH = process.env.PATH || '';
  const pathext = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM') : '';
  const exts = process.platform === 'win32' ? pathext.split(';') : [''];
  for (const d of PATH.split(path.delimiter)) {
    for (const ext of exts) {
      const full = path.join(d, process.platform === 'win32' ? cmd + ext : cmd);
      try { if (fs.existsSync(full)) return full; } catch {}
    }
  }
  return null;
}

function getChromiumCandidates(chromiumOnly: boolean): string[] {
  const plat = process.platform;
  const cands: string[] = [];
  if (process.env.CHROME_PATH) cands.push(process.env.CHROME_PATH);
  if (plat === 'darwin') {
    if (chromiumOnly) {
      cands.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
    } else {
      cands.push(
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
      );
    }
  } else if (plat === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:/Program Files';
    const pfx86 = process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)';
    if (chromiumOnly) {
      cands.push(`${pf}/Chromium/Application/chromium.exe`, `${pfx86}/Chromium/Application/chromium.exe`);
    } else {
      cands.push(
        `${pf}/Chromium/Application/chromium.exe`, `${pfx86}/Chromium/Application/chromium.exe`,
        `${pf}/Google/Chrome/Application/chrome.exe`, `${pfx86}/Google/Chrome/Application/chrome.exe`,
        `${pf}/Microsoft/Edge/Application/msedge.exe`, `${pfx86}/Microsoft/Edge/Application/msedge.exe`
      );
    }
  } else {
    if (chromiumOnly) {
      cands.push('chromium', 'chromium-browser', '/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser');
    } else {
      cands.push(
        'chromium', 'chromium-browser', '/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser',
        'google-chrome-stable', 'google-chrome', 'brave-browser', 'microsoft-edge'
      );
    }
  }
  return cands;
}

function resolveExecutable(chromiumOnly: boolean): { path: string | null; tried: string[] } {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return { path: process.env.CHROME_PATH, tried: [process.env.CHROME_PATH] };
  const cands = getChromiumCandidates(chromiumOnly);
  const tried: string[] = [];
  for (const c of cands) {
    if (!c) continue;
    if (c.includes('/') || c.includes('\\')) { tried.push(c); if (fs.existsSync(c)) return { path: c, tried }; }
    else { const r = resolveOnPath(c); tried.push(r || c); if (r) return { path: r, tried }; }
  }
  return { path: null, tried };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LaunchReq;
  const url = body.url;
  if (!url || !isHttpUrl(url)) return new Response('Bad url', { status: 400 });
  const chromiumOnly = body.chromiumOnly !== false; // default true
  const fallbackDirect = body.fallbackDirect !== false; // default true

  // Dynamically import puppeteer so the bundle stays optional locally while still
  // allowing hosting platforms (Vercel) to detect the dependency and ship it.
  let puppeteer: any = null;
  let usingCore = false;
  let chromiumLib: any = null; // @sparticuz/chromium when available (serverless-friendly)
  const isServerless = !!(process.env.VERCEL || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);
  try {
    const mod = await import('puppeteer-core');
    puppeteer = mod?.default ?? mod;
    usingCore = true;
    try {
      const chrS = await import('@sparticuz/chromium');
      chromiumLib = (chrS as any)?.default ?? chrS;
    } catch {
      // no serverless chromium available; will fall back to local executable
    }
    // Only use bundled serverless Chromium on serverless platforms
    if (!isServerless) chromiumLib = null;
  } catch {
    return Response.json(
      { ok: false, message: 'puppeteer-core not installed. Please add puppeteer-core.' },
      { status: 500 },
    );
  }
  if (!puppeteer?.launch) {
    return Response.json(
      { ok: false, message: 'Detected puppeteer module without a launch() helper.' },
      { status: 500 },
    );
  }

  function buildArgs(withProxy: boolean): string[] {
    const argv: string[] = [];
    if (withProxy) argv.push(`--proxy-server=${process.env.PROXY_URL || 'http://localhost:8081'}`);
    argv.push('--start-maximized');
    argv.push('--window-size=1600,1000');
    argv.push('--force-device-scale-factor=1');
    if (process.env.CHROME_DISABLE_WEB_SECURITY === '1') {
      const profile = process.env.CHROME_PROFILE_DIR || `${os.tmpdir()}/seclab-puppeteer-profile`;
      argv.push('--disable-web-security', `--user-data-dir=${profile}`);
    }
    if (process.env.CHROME_EXTRA_FLAGS) argv.push(...process.env.CHROME_EXTRA_FLAGS.split(' '));
    return argv;
  }

  async function launch(withProxy: boolean) {
    const launchOpts: any = {
      headless: body.headless ?? (isServerless ? true : false),
      devtools: body.devtools ?? false,
      args: buildArgs(withProxy),
      ignoreHTTPSErrors: process.env.CHROME_IGNORE_CERT_ERRORS === '1',
      defaultViewport: { width: 1600, height: 960, deviceScaleFactor: 1 },
    };
    // Prefer serverless chromium when available (Vercel/AWS Lambda)
    if (usingCore && chromiumLib && isServerless) {
      try {
        const exe = await chromiumLib.executablePath();
        launchOpts.executablePath = exe;
        launchOpts.args = [...(chromiumLib.args || []), ...launchOpts.args];
        // Force headless in serverless environments
        launchOpts.headless = chromiumLib.headless ?? true;
      } catch (e) {
        // fall back to local resolution below
      }
    }
    if (usingCore && !launchOpts.executablePath) {
      const { path: exe, tried } = resolveExecutable(chromiumOnly);
      if (!exe) throw new Error('Chromium not found. Set CHROME_PATH for puppeteer-core. Tried: ' + tried.join(', '));
      launchOpts.executablePath = exe;
    }
    const browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    try { await page.setViewport({ width: 1600, height: 960, deviceScaleFactor: 1 }); } catch {}
    // Capture flows via Chromium network events and apply Intercept when enabled
    try {
      const store = getStore();
      const istore = interceptStore();
      const pendingReqBodies = new Map<any, string | undefined>();
      const reqIsPreflight = new Map<any, boolean>();
      await page.setRequestInterception(true);
      page.on('request', async (req: any) => {
        try {
          const url = req.url();
          if (url.startsWith('data:') || url.startsWith('chrome-extension:') || url.startsWith('devtools:')) {
            return req.continue();
          }
          const method = req.method();
          const headersObj = (req.headers ? req.headers() : {}) as Record<string, string>;
          const preflight = method === 'OPTIONS' && (headersObj['Access-Control-Request-Method'] || headersObj['access-control-request-method']);
          reqIsPreflight.set(req, !!preflight);
          // Auto-allow CORS preflight so you only see the actual POST/PUT/etc
          if (preflight) {
            return req.continue();
          }
          const bodyStr = req.postData && typeof req.postData === 'function' ? req.postData() : undefined;
          pendingReqBodies.set(req, bodyStr);
          if (!istore.isEnabled()) {
            return req.continue();
          }
          const decision = await istore.hold({ method, url, headers: headersObj, body: bodyStr });
          if (decision.action === 'drop') {
            return req.abort();
          }
          const overrides: any = {};
          if (decision.url && decision.url !== url) overrides.url = decision.url;
          if (decision.method && decision.method !== method) overrides.method = decision.method;
          if (decision.headers) {
            const h = { ...decision.headers } as Record<string, string>;
            // Let Chromium set content-length for modified bodies
            for (const k of Object.keys(h)) {
              if (k.toLowerCase() === 'content-length') delete (h as any)[k];
            }
            overrides.headers = h as any;
          }
          if (decision.body !== undefined) overrides.postData = decision.body;
          return req.continue(overrides);
        } catch (e) {
          try { return req.continue(); } catch {}
        }
      });
      page.on('response', async (res: any) => {
        try {
          const req = res.request();
          if (reqIsPreflight.get(req)) { reqIsPreflight.delete(req); pendingReqBodies.delete(req); return; }
          const url = req.url();
          const method = req.method();
          const headers = req.headers ? req.headers() : {};
          const status = res.status();
          const respHeaders = res.headers ? res.headers() : {};
          let bodyPreview = '';
          try {
            const buf = await res.buffer();
            if (buf) bodyPreview = buf.toString('utf8').slice(0, 4096);
          } catch {}
          const reqBody = pendingReqBodies.get(req);
          store.recordFlow({
            method,
            url,
            requestHeaders: headers || {},
            requestBody: reqBody,
            responseStatus: status,
            responseHeaders: respHeaders || {},
            responseBodyPreview: bodyPreview,
            source: 'puppeteer',
          });
          pendingReqBodies.delete(req);
          reqIsPreflight.delete(req);
        } catch {}
      });
      // Use Chrome DevTools Protocol Fetch domain to allow response edit
      try {
        const cdp = await page.target().createCDPSession();
        await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Response' }] });
        cdp.on('Fetch.requestPaused', async (ev: any) => {
          try {
            if (!ev.responseStatusCode) {
              await cdp.send('Fetch.continueRequest', { requestId: ev.requestId });
              return;
            }
            const url = ev.request.url as string;
            const method = (ev.request.method as string) || 'GET';
            const bodyObj = await cdp.send('Fetch.getResponseBody', { requestId: ev.requestId });
            const bodyStr = bodyObj.base64Encoded ? Buffer.from(bodyObj.body, 'base64').toString('utf8') : (bodyObj.body || '');
            const respHeadersArr = (ev.responseHeaders || []) as Array<{ name: string; value?: string }>;
            const respHeaderMap: Record<string, string> = {};
            for (const h of respHeadersArr) { if (h && h.name) respHeaderMap[h.name] = h.value ?? ''; }
            let decision = { action: 'send' } as any;
            if (istore.shouldHoldResponse(url)) {
              decision = await istore.holdResponse({ method, url, responseStatus: ev.responseStatusCode, responseHeaders: respHeaderMap, responseBody: bodyStr }) as any;
            }
            if (decision.action === 'drop') {
              await cdp.send('Fetch.failRequest', { requestId: ev.requestId, errorReason: 'Aborted' });
              return;
            }
            const newStatus = decision.responseStatus ?? ev.responseStatusCode;
            const newHeadersMap: Record<string, string> = decision.responseHeaders ?? respHeaderMap;
            const newBodyStr: string = decision.responseBody ?? bodyStr;
            for (const k of Object.keys(newHeadersMap)) { if (k.toLowerCase() === 'content-length') delete (newHeadersMap as any)[k]; }
            const headersArr: Array<{ name: string; value: string }> = Object.entries(newHeadersMap).map(([k, v]) => ({ name: k, value: String(v) }));
            await cdp.send('Fetch.fulfillRequest', {
              requestId: ev.requestId,
              responseCode: newStatus,
              responseHeaders: headersArr,
              body: Buffer.from(newBodyStr, 'utf8').toString('base64'),
            });
          } catch (e) {
            try { await cdp.send('Fetch.continueRequest', { requestId: ev.requestId }); } catch {}
          }
        });
      } catch {}
    } catch {}
    if (body.bypassCSP) { try { await page.setBypassCSP(true); } catch {} }
    return { browser, page, launchOpts };
  }

  try {
    // First attempt: honor viaProxy flag
    const first = await launch(!!body.viaProxy);
    let navError: any = null;
    try {
      await first.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (e: any) {
      navError = e;
    }
    if (navError && body.viaProxy && fallbackDirect) {
      try { await first.browser.close(); } catch {}
      const second = await launch(false);
      try {
        await second.page.goto(url, { waitUntil: 'domcontentloaded' });
        return Response.json({ ok: true, launched: true, usingCore, usedProxy: false, fallback: 'direct', headless: second.launchOpts.headless });
      } catch (e: any) {
        return Response.json({ ok: false, message: 'Navigation failed (proxy and direct)', error: String(e?.message || e || ''), firstError: String(navError?.message || navError || '') }, { status: 500 });
      }
    }
    // Success or non-proxy attempt
    return Response.json({ ok: !navError, launched: true, usingCore, usedProxy: !!body.viaProxy && !navError, headless: first.launchOpts.headless, navError: navError ? String(navError?.message || navError || '') : undefined });
  } catch (error: any) {
    return Response.json({ ok: false, message: 'Failed to launch Puppeteer', error: String(error?.message || error || '') }, { status: 500 });
  }
}
