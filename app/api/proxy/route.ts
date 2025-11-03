export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { httpRequest } from '@/lib/httpClient';
import { getStore } from '@/lib/store';
import { applyHeaderRules } from '@/lib/headers';
import { runOnResponse } from '@/lib/plugins';
import { interceptStore } from '@/lib/interceptStore';

export async function GET(req: NextRequest) {
  const store = getStore();
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  if (!target) return new Response('Missing url param', { status: 400 });
  const u = new URL(target);
  const host = u.hostname;
  const pathName = u.pathname;
  const rules = store.matchRules(host, pathName);

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'host') return; // will be set by client
    if (k.toLowerCase().startsWith('x-forwarded')) return;
    headers[k] = v;
  });

  try {
    // Intercept: if enabled, wait for user decision and allow edits
    const istore = interceptStore();
    let effectiveUrl = target;
    let effectiveHeaders = { ...headers } as Record<string, string>;
    if (istore.isEnabled()) {
      const decision = await istore.hold({ method: 'GET', url: target, headers });
      if (decision.action === 'drop') {
        return new Response('Request dropped by interceptor', { status: 418 });
      }
      if (decision.url) effectiveUrl = decision.url;
      if (decision.headers) effectiveHeaders = decision.headers;
    }
    const resp = await httpRequest('GET', effectiveUrl, effectiveHeaders);
    const modifiedHeaders = applyHeaderRules(normalizeHeaders(resp.headers), rules);
    const bodyStr = resp.body.toString('utf8');
    const flow = store.recordFlow({
      method: 'GET',
      url: effectiveUrl,
      requestHeaders: effectiveHeaders,
      responseStatus: resp.status,
      responseHeaders: modifiedHeaders,
      responseBodyPreview: bodyStr.slice(0, 4096),
      source: 'reverse-proxy',
    });
    runOnResponse(flow);

    const ct = (modifiedHeaders['content-type'] || '').toLowerCase();
    const ce = (modifiedHeaders['content-encoding'] || '').toLowerCase();
    // For HTML, inject base + link rewriter so navigation stays via proxy
    if (ct.includes('text/html') && (!ce || ce === 'identity')) {
      const injected = injectNavigation(bodyStr, target);
      const h = new Headers(Object.entries({ ...modifiedHeaders, 'content-length': String(Buffer.byteLength(injected)) }));
      return new Response(injected, { status: resp.status, headers: h });
    } else {
      return new Response(resp.body as unknown as BodyInit, {
        status: resp.status,
        headers: new Headers(Object.entries(modifiedHeaders)),
      });
    }
  } catch (e: any) {
    return new Response(`Proxy error: ${e?.message || 'unknown'}`, { status: 502 });
  }
}

function normalizeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}

function injectNavigation(html: string, baseUrl: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const base = `<base href="${baseUrl}">`;
  const script = `<script>(function(){
    function toProxy(u){try{return '/api/proxy?url='+encodeURIComponent(new URL(u, document.baseURI).toString());}catch(e){return u;}}
    document.addEventListener('click', function(ev){
      let el = ev.target; while (el && el.tagName !== 'A') el = el.parentElement;
      if (el && el.tagName === 'A' && el.getAttribute('href')){
        const href = el.getAttribute('href');
        if (href && !href.startsWith('javascript:') && el.target !== '_blank' && !el.hasAttribute('download')){
          ev.preventDefault(); location.href = toProxy(el.href);
        }
      }
    }, true);
    const _open = window.open; window.open = function(u, n, s){ return _open(toProxy(u), n, s); };
    // Rewrite iframe/src and anchor/href on mutations
    const mo = new MutationObserver((recs)=>{
      for (const r of recs){
        if (r.type === 'attributes'){
          const el = r.target;
          if (el instanceof HTMLIFrameElement && r.attributeName === 'src') {
            const s = el.getAttribute('src'); if (s) el.setAttribute('src', toProxy(s));
          }
          if (el instanceof HTMLAnchorElement && r.attributeName === 'href'){
            const h = el.getAttribute('href'); if (h) el.setAttribute('href', toProxy(h));
          }
        }
        if (r.type === 'childList'){
          r.addedNodes.forEach((n)=>{
            if (n instanceof HTMLIFrameElement){ const s = n.getAttribute('src'); if (s) n.setAttribute('src', toProxy(s)); }
            if (n instanceof HTMLAnchorElement){ const h = n.getAttribute('href'); if (h) n.setAttribute('href', toProxy(h)); }
          });
        }
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['src','href'], subtree: true, childList: true });
  })();</script>`;
  const injection = `\n${base}\n${script}\n`;
  const headIdx = html.search(/<head\b[^>]*>/i);
  if (headIdx !== -1) {
    const insertAt = headIdx + html.match(/<head\b[^>]*>/i)![0].length;
    return html.slice(0, insertAt) + injection + html.slice(insertAt);
  }
  // If no <head>, inject at start of document inside a synthetic head
  return `<!DOCTYPE html><html><head>${injection}</head><body>` + html + `</body></html>`;
}
