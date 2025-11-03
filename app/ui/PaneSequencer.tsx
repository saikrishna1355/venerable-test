"use client";

import { useMemo, useState } from 'react';

function entropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  const n = str.length;
  return Object.values(freq).reduce((h, f) => {
    const p = f / n; return h - p * Math.log2(p);
  }, 0);
}

export default function PaneSequencer() {
  const [tokens, setTokens] = useState('');
  const lines = useMemo(() => tokens.split(/\r?\n/).map(s => s.trim()).filter(Boolean), [tokens]);
  const entropies = useMemo(() => lines.map((t) => ({ t, h: entropy(t) })), [lines]);
  const avg = useMemo(() => entropies.reduce((a,b)=>a+b.h,0)/(entropies.length||1), [entropies]);

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <textarea value={tokens} onChange={(e)=>setTokens(e.target.value)} placeholder={'Paste tokens here, one per line'} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <div className="text-sm">
        <div className="mb-2 text-xs text-zinc-500">Entropy per token (bits/char)</div>
        <table className="w-full text-xs">
          <thead><tr><th className="text-left p-1">Token</th><th className="text-left p-1 w-32">Entropy</th></tr></thead>
          <tbody>
            {entropies.map(e => <tr key={e.t}><td className="p-1 truncate max-w-[24rem]" title={e.t}>{e.t}</td><td className="p-1">{e.h.toFixed(3)}</td></tr>)}
          </tbody>
        </table>
        <div className="mt-3 text-xs">Average entropy: {avg.toFixed(3)}</div>
      </div>
    </div>
  );
}

