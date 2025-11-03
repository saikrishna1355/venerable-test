"use client";

import { useEffect, useMemo, useState } from 'react';

type Item = {
  id: string;
  createdAt: number;
  stage: 'request' | 'response';
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  state: 'pending' | 'sent' | 'dropped';
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
};

export default function InterceptPage() {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editMethod, setEditMethod] = useState('GET');
  const [editHeaders, setEditHeaders] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRespStatus, setEditRespStatus] = useState<number | undefined>(undefined);
  const [editRespHeaders, setEditRespHeaders] = useState('');
  const [editRespBody, setEditRespBody] = useState('');

  const load = async () => {
    const r = await fetch('/api/intercept/queue');
    const d = await r.json();
    setEnabled(!!d.enabled);
    setItems(d.items || []);
  };
  useEffect(() => {
    load();
    const iv = setInterval(load, 1500);
    return () => clearInterval(iv);
  }, []);

  const toggle = async () => {
    const r = await fetch('/api/intercept/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) });
    const d = await r.json();
    setEnabled(d.enabled);
  };

  const select = (it: Item) => {
    setSelected(it);
    setEditUrl(it.url);
    setEditMethod(it.method || 'GET');
    setEditHeaders(Object.entries(it.headers || {}).map(([k,v]) => `${k}: ${v}`).join('\n'));
    setEditBody(it.body || '');
    setEditRespStatus(it.responseStatus);
    setEditRespHeaders(Object.entries(it.responseHeaders || {}).map(([k,v]) => `${k}: ${v}`).join('\n'));
    setEditRespBody(it.responseBody || '');
  };

  const send = async () => {
    if (!selected) return;
    const headers: Record<string,string> = {};
    editHeaders.split(/\r?\n/).forEach((line)=>{ const i=line.indexOf(':'); if(i>0) headers[line.slice(0,i).trim()] = line.slice(i+1).trim(); });
    const respHeaders: Record<string,string> = {};
    editRespHeaders.split(/\r?\n/).forEach((line)=>{ const i=line.indexOf(':'); if(i>0) respHeaders[line.slice(0,i).trim()] = line.slice(i+1).trim(); });
    await fetch(`/api/intercept/item/${selected.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', url: editUrl, method: editMethod, headers, body: editBody, responseStatus: editRespStatus, responseHeaders: respHeaders, responseBody: editRespBody }) });
    setSelected(null);
    load();
  };
  const drop = async () => {
    if (!selected) return;
    await fetch(`/api/intercept/item/${selected.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'drop' }) });
    setSelected(null);
    load();
  };

  const toRepeater = async () => {
    if (!selected) return;
    // Parse headers from editor text
    const headers: Record<string,string> = {};
    editHeaders.split(/\r?\n/).forEach((line)=>{ const i=line.indexOf(':'); if(i>0) headers[line.slice(0,i).trim()] = line.slice(i+1).trim(); });
    const r = await fetch('/api/repeater/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: editMethod, url: editUrl, headers, body: editBody }) });
    if (r.ok) {
      const d = await r.json();
      window.location.href = `/repeater?id=${encodeURIComponent(d.id)}`;
    }
  };

  return (
    <div className="min-h-[calc(100dvh-48px)] w-screen bg-gradient-to-b from-[var(--bg-grad-from)] to-[var(--bg-grad-to)] text-[var(--foreground)] p-4 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Intercept</div>
        <div className="flex items-center gap-2">
          <button
            onClick={async ()=>{ await fetch('/api/intercept/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendAll' }) }); load(); }}
            className="btn tiny"
          >Send all</button>
          <button
            onClick={async ()=>{ await fetch('/api/intercept/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dropAll' }) }); load(); }}
            className="btn tiny"
          >Clear (drop all)</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="panel overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur"><tr><th className="text-left p-2 w-20">Method</th><th className="text-left p-2">URL</th><th className="text-left p-2 w-36">Time</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 cursor-pointer" onClick={()=>select(it)}>
                  <td className="p-2">{it.method}</td>
                  <td className="p-2 truncate max-w-[32rem]" title={it.url}>{it.url}</td>
                  <td className="p-2">{new Date(it.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel p-2">
          <div className="text-sm font-medium mb-2">Edit & Forward</div>
          {selected ? (
            <div className="flex flex-col gap-4">
              {selected.stage === 'request' ? (
                <>
                  <div className="flex gap-2">
                    <select value={editMethod} onChange={(e)=>setEditMethod(e.target.value)} className="select px-2 py-1 text-sm">
                      {['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m=> <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input value={editUrl} onChange={(e)=>setEditUrl(e.target.value)} className="flex-1 input px-2 py-1 text-sm"/>
                  </div>
                  <div className="text-xs">Headers</div>
                  <textarea value={editHeaders} onChange={(e)=>setEditHeaders(e.target.value)} className="h-40 textarea p-2 text-xs font-mono"/>
                  <div className="text-xs">Body</div>
                  <textarea value={editBody} onChange={(e)=>setEditBody(e.target.value)} className="h-32 textarea p-2 text-xs font-mono"/>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input type="number" value={editRespStatus ?? 200} onChange={(e)=>setEditRespStatus(parseInt(e.target.value||'200',10))} className="w-24 input px-2 py-1 text-sm"/>
                    <span className="tiny">Status</span>
                    <input value={editUrl} onChange={(e)=>setEditUrl(e.target.value)} className="flex-1 input px-2 py-1 text-sm"/>
                  </div>
                  <div className="text-xs">Response headers</div>
                  <textarea value={editRespHeaders} onChange={(e)=>setEditRespHeaders(e.target.value)} className="h-32 textarea p-2 text-xs font-mono"/>
                  <div className="text-xs">Response body</div>
                  <textarea value={editRespBody} onChange={(e)=>setEditRespBody(e.target.value)} className="h-40 textarea p-2 text-xs font-mono"/>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={send} className="btn btn-primary text-sm">Send</button>
                <button onClick={drop} className="btn text-sm">Drop</button>
                {selected.stage === 'request' && (
                  <>
                    <button onClick={toRepeater} className="btn text-sm">To Repeater</button>
                    <button onClick={async ()=>{ await fetch('/api/intercept/response-watch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: editUrl }) }); await send(); }} className="btn text-sm">Edit response then Send</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Select a pending request or response to edit and forward.</div>
          )}
        </div>
      </div>
    </div>
  );
}
