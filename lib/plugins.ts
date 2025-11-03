import fs from 'fs';
import path from 'path';
import { getStore } from './store';
import { Flow, Plugin } from './types';

declare global {
  // eslint-disable-next-line no-var
  var __PLUGINS__: Plugin[] | undefined;
}

function builtinPlugins(): Plugin[] {
  // Passive header checks
  const passiveHeaders: Plugin = {
    id: 'builtin-passive-headers',
    name: 'Passive Header Checks',
    onResponse: (flow, ctx) => {
      const h = Object.fromEntries(
        Object.entries(flow.responseHeaders || {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      const url = flow.url;
      const ensure = (cond: boolean, title: string, severity: any = 'low', details?: string) => {
        if (!cond) {
          ctx.addFinding({ type: 'passive', title, severity, url, plugin: 'Passive Header Checks' });
        }
      };
      // Common headers
      ensure(!!h['content-security-policy'], 'Missing Content-Security-Policy header', 'medium');
      ensure(!!h['x-frame-options'] || (h['content-security-policy'] || '').includes('frame-ancestors'), 'Missing clickjacking protection (X-Frame-Options or CSP frame-ancestors)', 'medium');
      ensure(!!h['x-content-type-options'], 'Missing X-Content-Type-Options: nosniff', 'low');
      ensure(!!h['referrer-policy'], 'Missing Referrer-Policy', 'low');
      if (url.startsWith('http://')) {
        ctx.addFinding({ type: 'passive', title: 'HTTP (unencrypted) response', severity: 'low', url, plugin: 'Passive Header Checks' });
      }
    },
  };

  return [passiveHeaders];
}

export function loadPlugins(): Plugin[] {
  if (global.__PLUGINS__) return global.__PLUGINS__;
  const plugins: Plugin[] = [...builtinPlugins()];
  const pluginsDir = path.join(process.cwd(), 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const file of fs.readdirSync(pluginsDir)) {
      if (!file.endsWith('.js') && !file.endsWith('.cjs')) continue;
      try {
        // bypass bundler static analysis
        // eslint-disable-next-line no-eval
        const req: NodeRequire = eval('require');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = req(path.join(pluginsDir, file));
        const plugin: Plugin | undefined = (mod as any)?.default || mod;
        if (plugin && (plugin as any).id && typeof plugin === 'object') {
          plugins.push(plugin as any);
        }
      } catch (e) {
        // ignore bad plugin load
      }
    }
  }
  global.__PLUGINS__ = plugins;
  return plugins;
}

export async function runOnRequest(flow: Flow) {
  const store = getStore();
  const ctx = { recordFlow: store.recordFlow, addFinding: store.addFinding };
  for (const p of loadPlugins()) {
    if (p.onRequest) await p.onRequest(flow, ctx);
  }
}

export async function runOnResponse(flow: Flow) {
  const store = getStore();
  const ctx = { recordFlow: store.recordFlow, addFinding: store.addFinding };
  for (const p of loadPlugins()) {
    if (p.onResponse) await p.onResponse(flow, ctx);
  }
}
