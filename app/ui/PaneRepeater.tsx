"use client";

import { useState } from 'react';
import CollapsibleSection from './CollapsibleSection';

export default function PaneRepeater() {
  const [url, setUrl] = useState('https://example.com');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('User-Agent: SecLab/1.0');
  const [body, setBody] = useState('');
  const [resp, setResp] = useState<{ status: number; headers: Record<string,string>; body: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    setResp(null);
    const hdrs: Record<string,string> = {};
    headers.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) hdrs[line.slice(0, idx).trim()] = line.slice(idx+1).trim();
    });
    const r = await fetch('/api/repeater', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url, headers: hdrs, body }),
    });
    if (!r.ok) {
      setResp({ status: r.status, headers: {}, body: await r.text() });
    } else {
      const data = await r.json();
      setResp({ status: data.status, headers: data.headers, body: data.body });
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <CollapsibleSection title="Request" defaultOpen={true} className="flex flex-col">
        <div className="flex gap-2 mb-3">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="select">
            {['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 input"/>
          <button onClick={send} disabled={loading} className="btn btn-primary">Send</button>
        </div>
        
        <CollapsibleSection title="Headers" defaultOpen={true}>
          <textarea 
            value={headers} 
            onChange={(e) => setHeaders(e.target.value)} 
            className="w-full h-24 textarea font-mono"
            placeholder="Header-Name: value"
          />
        </CollapsibleSection>
        
        <CollapsibleSection title="Body" className="mt-3">
          <textarea 
            value={body} 
            onChange={(e) => setBody(e.target.value)} 
            className="w-full h-32 textarea font-mono"
            placeholder="Request body content"
          />
        </CollapsibleSection>
      </CollapsibleSection>
      
      <CollapsibleSection title={`Response ${resp ? `(${resp.status})` : ''}`} defaultOpen={true} className="flex flex-col">
        <CollapsibleSection title="Response Headers" defaultOpen={true}>
          <pre className="w-full h-24 p-2 text-xs overflow-auto font-mono bg-zinc-50 dark:bg-zinc-900 rounded border">
            {resp ? Object.entries(resp.headers).map(([k,v]) => `${k}: ${v}`).join('\n') : ''}
          </pre>
        </CollapsibleSection>
        
        <CollapsibleSection title="Response Body" defaultOpen={true} className="mt-3">
          <pre className="w-full h-48 p-2 text-xs overflow-auto font-mono bg-zinc-50 dark:bg-zinc-900 rounded border">
            {resp?.body || ''}
          </pre>
        </CollapsibleSection>
      </CollapsibleSection>
    </div>
  );
}