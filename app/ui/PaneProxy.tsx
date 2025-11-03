"use client";

import { useMemo, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';

export default function PaneProxy() {
  const [url, setUrl] = useState('https://example.com');
  const [viaProxy, setViaProxy] = useState(true);
  const [onlyChromium, setOnlyChromium] = useState(true);
  const [appMode, setAppMode] = useState(true);
  const [bypassCSP, setBypassCSP] = useState(true);
  const proxiedSrc = useMemo(() => `/api/proxy?url=${encodeURIComponent(url)}`, [url]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <CollapsibleSection title="Proxy Configuration" defaultOpen={true}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://target.example/"
            className="flex-1 min-w-[260px] input"
          />
          <button
            onClick={async () => {
              try {
                const r = await fetch('/api/chromium/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, viaProxy, onlyChromium, appMode }) });
                if (!r.ok) {
                  const t = await r.text(); alert('Failed to open Chromium: ' + t);
                }
              } catch (e: any) {
                alert('Failed to open Chromium: ' + (e?.message || e));
              }
            }}
            className="btn tiny"
          >
            Open Chromium App
          </button>
        </div>
        
        <CollapsibleSection title="Advanced Options" className="mt-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={async () => {
                try {
                  const r = await fetch('/api/puppeteer/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, viaProxy, bypassCSP, chromiumOnly: onlyChromium, headless: false, devtools: false }) });
                  const t = await r.text();
                  if (!r.ok) alert('Failed to open via Puppeteer: ' + t);
                } catch (e: any) {
                  alert('Failed to open via Puppeteer: ' + (e?.message || e));
                }
              }}
              className="btn tiny"
            >
              Open via Puppeteer
            </button>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={viaProxy} onChange={(e)=>setViaProxy(e.target.checked)} /> Via forward proxy
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={onlyChromium} onChange={(e)=>setOnlyChromium(e.target.checked)} /> Chromium only
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={appMode} onChange={(e)=>setAppMode(e.target.checked)} /> App window
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={bypassCSP} onChange={(e)=>setBypassCSP(e.target.checked)} /> Bypass CSP (Puppeteer)
            </label>
          </div>
        </CollapsibleSection>
      </CollapsibleSection>
      
      <CollapsibleSection title="Proxy Viewer" defaultOpen={true} className="flex-1">
        <div className="h-96 border border-zinc-300 dark:border-zinc-800 rounded overflow-hidden bg-white dark:bg-black">
          <iframe title="viewer" src={proxiedSrc} className="w-full h-full" />
        </div>
      </CollapsibleSection>
    </div>
  );
}
