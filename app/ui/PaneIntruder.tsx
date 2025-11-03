"use client";

import { useState } from 'react';

export default function PaneIntruder() {
  const [url, setUrl] = useState('https://example.com/?q=§test§');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('User-Agent: SecLab/1.0');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [wordlist, setWordlist] = useState('test\nadmin\nroot');
  const [results, setResults] = useState<{index:number;status:number;length:number}[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResults([]);
    const hdrs: Record<string,string> = {};
    headers.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) hdrs[line.slice(0, idx).trim()] = line.slice(idx+1).trim();
    });
    const payloads = wordlist.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const r = await fetch('/api/intruder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, method, headers: hdrs, bodyTemplate, payloads })
    });
    const d = await r.json();
    setResults(d.results || []);
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select value={method} onChange={(e)=>setMethod(e.target.value)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm">
            {['GET','POST','PUT','PATCH','DELETE'].map(m=> <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={url} onChange={(e)=>setUrl(e.target.value)} className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm"/>
          <button onClick={run} disabled={loading} className="text-sm px-3 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black disabled:opacity-50">Start</button>
        </div>
        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="flex flex-col">
            <div className="text-xs mb-1">Headers</div>
            <textarea value={headers} onChange={(e)=>setHeaders(e.target.value)} className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
          </div>
          <div className="flex flex-col">
            <div className="text-xs mb-1">Body Template (use § placeholders)</div>
            <textarea value={bodyTemplate} onChange={(e)=>setBodyTemplate(e.target.value)} className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex-1 grid grid-rows-2 gap-2">
          <div className="flex flex-col">
            <div className="text-xs mb-1">Payloads (one per line)</div>
            <textarea value={wordlist} onChange={(e)=>setWordlist(e.target.value)} className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
          </div>
          <div className="overflow-auto border rounded border-zinc-300 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900"><tr><th className="text-left p-1 w-16">#</th><th className="text-left p-1 w-20">Status</th><th className="text-left p-1 w-24">Length</th></tr></thead>
              <tbody>
                {results.map(r => <tr key={r.index} className="border-t border-zinc-200 dark:border-zinc-800"><td className="p-1">{r.index}</td><td className="p-1">{r.status}</td><td className="p-1">{r.length}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

