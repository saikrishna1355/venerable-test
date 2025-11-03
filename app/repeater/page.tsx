"use client";

import { useEffect, useMemo, useState } from 'react';

export default function RepeaterPage() {
  const [url, setUrl] = useState('https://example.com');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('User-Agent: SecLab/1.0');
  const [body, setBody] = useState('');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState<Array<{
    index: number;
    status?: number;
    durationMs?: number;
    req: { method: string; url: string; headers: string; body?: string };
    res?: { headers: Record<string,string>; body: string };
    error?: string;
  }>>([]);
  const [prettyJSON, setPrettyJSON] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  type GenMode = 'constant' | 'counter' | 'random' | 'uuid' | 'wordlist';
  type Gen = {
    name: string;
    mode: GenMode;
    constant?: string;
    counterStart?: number;
    counterStep?: number;
    counterCount?: number; // optional: auto-run count when global count = 1
    counterTo?: number; // optional: inclusive end; when set and global count = 1, compute runs from start..to with step
    randomLen?: number;
    randomCharset?: string; // "aA0" => letters + digits
    wordlist?: string; // one per line
  };
  const [gens, setGens] = useState<Gen[]>([]);

  const allPlaceholders = useMemo(() => {
    const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const s: Set<string> = new Set();
    const collect = (txt: string) => { let m; while ((m = re.exec(txt))) s.add(m[1]); };
    collect(url); collect(headers); collect(body);
    return Array.from(s);
  }, [url, headers, body]);

  useEffect(() => {
    // ensure gens contains all placeholders
    setGens((prev) => {
      const by = Object.fromEntries(prev.map(g => [g.name, g] as const));
      const next: Gen[] = [];
      for (const name of allPlaceholders) {
        next.push(by[name] || { name, mode: 'constant', constant: '' });
      }
      return next;
    });
  }, [allPlaceholders]);

  const setGen = (name: string, patch: Partial<Gen>) =>
    setGens((prev) => prev.map((g) => (g.name === name ? { ...g, ...patch } : g)));

  const genValue = (g: Gen, run: number) => {
    switch (g.mode) {
      case 'constant':
        return g.constant ?? '';
      case 'counter': {
        const start = Number.isFinite(g.counterStart) ? (g.counterStart as number) : 1;
        const step = Number.isFinite(g.counterStep) ? (g.counterStep as number) : 1;
        return String(start + run * step);
      }
      case 'random': {
        const len = (g.randomLen ?? 8) as number;
        const charsetFlags = g.randomCharset || 'aA0';
        let chars = '';
        if (charsetFlags.includes('a')) chars += 'abcdefghijklmnopqrstuvwxyz';
        if (charsetFlags.includes('A')) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (charsetFlags.includes('0')) chars += '0123456789';
        if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const arr = new Uint32Array(len);
        (typeof crypto !== 'undefined' ? crypto.getRandomValues(arr) : arr).forEach(()=>{});
        let out = '';
        for (let i = 0; i < len; i++) {
          const v = typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random()*0xffffffff);
          out += chars[v % chars.length];
        }
        return out;
      }
      case 'uuid':
        return (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : (Math.random().toString(16).slice(2) + '-' + Date.now());
      case 'wordlist': {
        const list = (g.wordlist || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
        if (list.length === 0) return '';
        return list[run % list.length];
      }
      default:
        return '';
    }
  };

  const applyGenerators = (text: string, run: number) => {
    if (!text) return text;
    return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, p1) => {
      const g = gens.find((x) => x.name === p1);
      return g ? genValue(g, run) : '';
    });
  };

  const formatBody = (text?: string) => {
    const s = text || '';
    if (!prettyJSON) return s;
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  };

  const makeCurl = (r: { req: { method: string; url: string; headers: string; body?: string } }) => {
    const esc = (v: string) => v.replace(/'/g, "'\\''");
    const parts: string[] = [];
    parts.push(`curl -i -X ${r.req.method} '${esc(r.req.url)}'`);
    (r.req.headers || '').split(/\r?\n/).forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) {
        const k = line.slice(0, i).trim();
        const v = line.slice(i + 1).trim();
        parts.push(`-H '${esc(`${k}: ${v}`)}'`);
      }
    });
    if (r.req.body && r.req.body.length > 0) parts.push(`--data-binary '${esc(r.req.body)}'`);
    return parts.join(' ');
  };

  useEffect(() => {
    const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const id = sp ? sp.get('id') : null;
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/repeater/drafts/${encodeURIComponent(id)}`);
        if (!r.ok) return;
        const d = await r.json();
        setMethod(d.method || 'GET');
        setUrl(d.url || '');
        if (d.headers) setHeaders(Object.entries(d.headers as Record<string, string>).map(([k,v]) => `${k}: ${v}`).join('\n'));
        if (d.body) setBody(d.body);
      } catch {}
    })();
  }, []);

  const send = async () => {
    const hdrs: Record<string,string> = {};
    headers.split(/\r?\n/).forEach((line)=>{ const i=line.indexOf(':'); if(i>0) hdrs[line.slice(0,i).trim()] = line.slice(i+1).trim(); });
    setResults([]);
    // If user configured any generators but left count=1, determine auto runs:
    // - wordlist length (longest)
    // - counterTo (derive runs from start..to with step)
    const longestWordlist = gens.reduce((max, g) => g.mode === 'wordlist' ? Math.max(max, (g.wordlist || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).length) : max, 0);
    const runsFromTo = gens.reduce((max, g) => {
      if (g.mode !== 'counter') return max;
      if (!Number.isFinite(g.counterTo as number)) return max;
      const start = Number.isFinite(g.counterStart) ? (g.counterStart as number) : 1;
      const step = Number.isFinite(g.counterStep) ? (g.counterStep as number) : 1;
      const to = g.counterTo as number;
      if (step === 0) return max;
      const r = Math.floor((to - start) / step) + 1;
      return Math.max(max, r > 0 ? r : 0);
    }, 0);
    const hasCounter = gens.some((g) => g.mode === 'counter');
    const defaultCounterAuto = hasCounter ? 10 : 0; // if user leaves everything blank, run 10 by default for counters
    const autoRuns = Math.max(longestWordlist, runsFromTo, defaultCounterAuto);
    const runs = Math.max(1, count > 1 ? count : (autoRuns || 1));
    for (let i=0;i<runs;i++){
      const start = performance.now();
      try {
        // apply generators to URL, headers, and body for this run
        const runUrl = applyGenerators(url, i);
        const runBody = applyGenerators(body, i);
        const runHeaders: Record<string,string> = {};
        Object.entries(hdrs).forEach(([k,v]) => runHeaders[k] = applyGenerators(v, i));
        const r = await fetch('/api/repeater', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, url: runUrl, headers: runHeaders, body: runBody }) });
        const durationMs = performance.now() - start;
        if (!r.ok) {
          const txt = await r.text();
          setResults(prev => [...prev, {
            index: i+1,
            status: r.status,
            durationMs,
            req: { method, url: runUrl, headers: Object.entries(runHeaders).map(([k,v])=>`${k}: ${v}`).join('\n'), body: runBody },
            error: txt,
          }]);
        } else {
          const d = await r.json();
          setResults(prev => [...prev, {
            index: i+1,
            status: d.status,
            durationMs,
            req: { method, url: runUrl, headers: Object.entries(runHeaders).map(([k,v])=>`${k}: ${v}`).join('\n'), body: runBody },
            res: { headers: d.headers || {}, body: d.body || '' },
          }]);
        }
      } catch (e:any) {
        const durationMs = performance.now() - start;
        setResults(prev => [...prev, {
          index: i+1,
          durationMs,
          req: { method, url: applyGenerators(url, i), headers: headers, body: applyGenerators(body, i) },
          error: e?.message || String(e),
        }]);
      }
    }
  };

  return (
    <div className="min-h-[calc(100dvh-48px)] w-screen bg-gradient-to-b from-[var(--bg-grad-from)] to-[var(--bg-grad-to)] text-[var(--foreground)] p-4 transition-colors">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-semibold">Repeater</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select value={method} onChange={(e)=>setMethod(e.target.value)} className="select px-2 py-1 text-sm">
              {['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m=> <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={url} onChange={(e)=>setUrl(e.target.value)} className="flex-1 input px-2 py-1 text-sm"/>
            <input type="number" min={1} value={count} onChange={(e)=>setCount(parseInt(e.target.value||'1',10))} className="w-24 input px-2 py-1 text-sm"/>
            <button onClick={send} className="btn btn-primary text-sm px-3 py-1">Send x{count}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <textarea value={headers} onChange={(e)=>setHeaders(e.target.value)} className="h-48 textarea p-2 text-xs font-mono"/>
            <textarea value={body} onChange={(e)=>setBody(e.target.value)} className="h-48 textarea p-2 text-xs font-mono"/>
          </div>
          <div className="panel p-2">
            <div className="text-sm font-medium mb-2">Payload generators</div>
            <div className="text-xs mb-2">
              Use {'{{name}}'} placeholders in URL, headers, or body. Configure each field below.
              Counter uses three options: from, to, skip. If skip is empty, it defaults to 1 and runs from..to when global count = 1.
            </div>
            {gens.length === 0 && <div className="text-xs text-zinc-500">No placeholders detected.</div>}
            {gens.map(g => (
              <div key={g.name} className="grid grid-cols-5 gap-2 items-center mb-2">
                <div className="text-xs col-span-1 font-medium truncate" title={g.name}>{g.name}</div>
                <select className="select px-2 py-1 text-xs col-span-1" value={g.mode} onChange={(e)=>setGen(g.name, { mode: e.target.value as GenMode })}>
                  <option value="constant">constant</option>
                  <option value="counter">counter</option>
                  <option value="random">random</option>
                  <option value="uuid">uuid</option>
                  <option value="wordlist">wordlist</option>
                </select>
                {g.mode === 'constant' && (
                  <input className="input px-2 py-1 text-xs col-span-3" placeholder="value" value={g.constant||''} onChange={(e)=>setGen(g.name, { constant: e.target.value })}/>
                )}
                {g.mode === 'counter' && (
                  <div className="col-span-3 grid grid-cols-3 gap-2 items-center">
                    <input className="input px-2 py-1 text-xs" type="number" placeholder="from" value={g.counterStart ?? 1} onChange={(e)=>setGen(g.name, { counterStart: parseInt(e.target.value||'1',10) })}/>
                    <input className="input px-2 py-1 text-xs" type="number" placeholder="to" value={g.counterTo ?? ''} onChange={(e)=>setGen(g.name, { counterTo: e.target.value===''? undefined : parseInt(e.target.value,10) })}/>
                    <input className="input px-2 py-1 text-xs" type="number" placeholder="skip (optional)" value={g.counterStep ?? ''} onChange={(e)=>setGen(g.name, { counterStep: e.target.value===''? undefined : parseInt(e.target.value,10) })}/>
                  </div>
                )}
                {g.mode === 'random' && (
                  <div className="col-span-3 grid grid-cols-2 gap-2">
                    <input className="input px-2 py-1 text-xs" type="number" placeholder="len" value={g.randomLen ?? 8} onChange={(e)=>setGen(g.name, { randomLen: parseInt(e.target.value||'8',10) })}/>
                    <input className="input px-2 py-1 text-xs" placeholder="charset (aA0)" value={g.randomCharset || 'aA0'} onChange={(e)=>setGen(g.name, { randomCharset: e.target.value })}/>
                  </div>
                )}
                {g.mode === 'uuid' && (
                  <div className="col-span-3 text-xs text-zinc-500">auto-generate v4 UUID</div>
                )}
                {g.mode === 'wordlist' && (
                  <textarea className="textarea p-2 text-xs col-span-3" placeholder={'one value per line'} value={g.wordlist || ''} onChange={(e)=>setGen(g.name, { wordlist: e.target.value })}/>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Results</div>
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={prettyJSON} onChange={(e)=>setPrettyJSON(e.target.checked)} /> Pretty JSON</label>
              <button onClick={()=>{ const all: Record<number, boolean> = {}; results.forEach(r=>{ all[r.index]=true; }); setExpanded(all); }} className="btn tiny">Expand all</button>
              <button onClick={()=>{ setExpanded({}); }} className="btn tiny">Collapse all</button>
              <button onClick={()=>setResults([])} className="btn tiny">Clear</button>
            </div>
          </div>
          <div className="flex flex-col gap-3 max-h-[75vh] overflow-auto">
            {results.map(r => (
              <div key={r.index} className="panel">
                <div className="px-2 py-1 text-xs flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 cursor-pointer" onClick={()=> setExpanded(prev=>({ ...prev, [r.index]: !prev[r.index] }))}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 select-none">{expanded[r.index] ? '▾' : '▸'}</span>
                    <span>#{r.index} {r.status ?? '-'} {r.durationMs ? `(${Math.round(r.durationMs)} ms)` : ''}</span>
                  </div>
                  {r.res ? <div>{(r.res.body || '').length} bytes</div> : r.error ? <div className="text-red-500">{r.error}</div> : null}
                </div>
                <div className={`grid grid-cols-2 gap-2 px-2 transition-all duration-200 ${expanded[r.index] ? 'py-2 max-h-[1000px]' : 'py-0 max-h-0 overflow-hidden'}`}>
                  <div>
                    <div className="text-xs font-medium mb-1 flex items-center justify-between">
                      <div>Request</div>
                      <button onClick={async ()=>{ try { await navigator.clipboard.writeText(makeCurl(r)); } catch {} }} className="btn tiny">Copy cURL</button>
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap border rounded border-zinc-200 dark:border-zinc-800 p-2">{`${r.req.method} ${r.req.url}\n${r.req.headers}\n\n${formatBody(r.req.body)}`}</pre>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">Response</div>
                    {r.res ? (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap border rounded border-zinc-200 dark:border-zinc-800 p-2">{`${r.status} ${Object.entries(r.res.headers||{}).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\n${formatBody(r.res.body)}`}</pre>
                    ) : (
                      <div className="text-[11px] text-zinc-500">No response (error or dropped)</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {results.length === 0 && <div className="text-xs text-zinc-500">No results yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
