"use client";

import { useState } from 'react';

function diff(a: string, b: string): string {
  // Simple line diff
  const al = a.split(/\r?\n/);
  const bl = b.split(/\r?\n/);
  const max = Math.max(al.length, bl.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const l = al[i] ?? '';
    const r = bl[i] ?? '';
    if (l === r) out.push(`  ${l}`);
    else {
      if (l) out.push(`- ${l}`);
      if (r) out.push(`+ ${r}`);
    }
  }
  return out.join('\n');
}

export default function PaneComparer() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [d, setD] = useState('');

  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      <textarea value={a} onChange={(e)=>setA(e.target.value)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <textarea value={b} onChange={(e)=>setB(e.target.value)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <textarea readOnly value={d} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <div className="col-span-3"><button onClick={()=>setD(diff(a,b))} className="px-3 py-1 border rounded text-sm">Compare</button></div>
    </div>
  );
}

