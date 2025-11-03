import { HeaderMap, HeaderRule } from './types';

export function applyHeaderRules(headers: HeaderMap, rules: HeaderRule[]): HeaderMap {
  const h: HeaderMap = { ...headers };
  for (const r of rules) {
    if (r.actions.stripCSP) delete h['content-security-policy'];
    if (r.actions.stripXFO) delete h['x-frame-options'];
    if (r.actions.injectCSP) h['content-security-policy'] = r.actions.injectCSP;
    if (r.actions.removeHeaders) {
      for (const key of r.actions.removeHeaders) delete h[key.toLowerCase()];
    }
    if (r.actions.addHeaders) {
      for (const [k, v] of Object.entries(r.actions.addHeaders)) h[k.toLowerCase()] = v;
    }
  }
  return h;
}

