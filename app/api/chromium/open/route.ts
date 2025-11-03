export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

function isHttpUrl(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch {
    return false;
  }
}

function getCandidates(onlyChromium: boolean) {
  const plat = process.platform;
  const cands: string[] = [];
  if (process.env.CHROME_PATH) cands.push(process.env.CHROME_PATH);
  if (plat === 'darwin') {
    if (onlyChromium) {
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
    if (onlyChromium) {
      cands.push(
        `${pf}/Chromium/Application/chromium.exe`,
        `${pfx86}/Chromium/Application/chromium.exe`
      );
    } else {
      cands.push(
        `${pf}/Chromium/Application/chromium.exe`,
        `${pfx86}/Chromium/Application/chromium.exe`,
        `${pf}/Google/Chrome/Application/chrome.exe`,
        `${pfx86}/Google/Chrome/Application/chrome.exe`,
        `${pf}/Microsoft/Edge/Application/msedge.exe`,
        `${pfx86}/Microsoft/Edge/Application/msedge.exe`
      );
    }
  } else {
    if (onlyChromium) {
      cands.push(
        // PATH lookups
        'chromium',
        'chromium-browser',
        // common absolute locations (not always on PATH)
        '/snap/bin/chromium',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      );
    } else {
      cands.push(
        'chromium',
        'chromium-browser',
        '/snap/bin/chromium',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        'google-chrome-stable',
        'google-chrome',
        'brave-browser',
        'microsoft-edge'
      );
    }
  }
  return cands;
}

function resolveOnPath(cmd: string): string | null {
  const PATH = process.env.PATH || '';
  const pathext = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM') : '';
  const exts = process.platform === 'win32' ? pathext.split(';') : [''];
  for (const d of PATH.split(path.delimiter)) {
    for (const ext of exts) {
      const full = path.join(d, process.platform === 'win32' ? cmd + ext : cmd);
      try {
        if (fs.existsSync(full)) return full;
      } catch {}
    }
  }
  return null;
}

function resolveCandidates(cands: string[]): { resolved: string[]; tried: string[] } {
  const resolved: string[] = [];
  const tried: string[] = [];
  for (const c of cands) {
    if (!c) continue;
    if (c.includes('/') || c.includes('\\')) {
      tried.push(c);
      if (fs.existsSync(c)) resolved.push(c);
    } else {
      const r = resolveOnPath(c);
      tried.push(r || c);
      if (r) resolved.push(r);
    }
  }
  return { resolved, tried };
}

export async function POST(req: NextRequest) {
  const { url, viaProxy, onlyChromium, appMode } = (await req.json()) as { url: string; viaProxy?: boolean; onlyChromium?: boolean; appMode?: boolean };
  if (!url || !isHttpUrl(url)) return new Response('Bad url', { status: 400 });

  const args: string[] = [];
  if (process.env.CHROME_DISABLE_WEB_SECURITY === '1') {
    const profile = process.env.CHROME_PROFILE_DIR || `${os.tmpdir()}/seclab-chrome-profile`;
    args.push('--disable-web-security', `--user-data-dir=${profile}`);
  }
  if (process.env.CHROME_IGNORE_CERT_ERRORS === '1') args.push('--ignore-certificate-errors');
  if (viaProxy) args.push(`--proxy-server=${process.env.PROXY_URL || 'http://localhost:8080'}`);
  if (process.env.CHROME_EXTRA_FLAGS) args.push(...process.env.CHROME_EXTRA_FLAGS.split(' '));

  // Prefer a large window to avoid content appearing cramped
  args.push('--start-maximized');
  args.push('--window-size=1600,1000');
  if (appMode) {
    // App window simplifies UI (minimal chrome around content)
    args.push(`--app=${url}`);
  }

  const candidates = getCandidates(!!onlyChromium);
  const { resolved, tried } = resolveCandidates(candidates);
  if (resolved.length === 0) {
    return Response.json(
      {
        ok: false,
        message: 'Chromium not found on PATH. Set CHROME_PATH to your Chromium binary.',
        tried,
      },
      { status: 500 }
    );
  }

  const used = resolved[0];
  try {
    const child = spawn(used, appMode ? args : [...args, url], { stdio: 'ignore', detached: true });
    // Attach error handler to avoid uncaughtException if spawn fails asynchronously
    child.on('error', () => {/* swallow; process continues */});
    child.unref();
    return Response.json({ ok: true, used, args });
  } catch (error: any) {
    return Response.json(
      {
        ok: false,
        message: 'Failed to launch Chromium',
        used,
        error: String(error?.message || error || ''),
      },
      { status: 500 }
    );
  }
}
