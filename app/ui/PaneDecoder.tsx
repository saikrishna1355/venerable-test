"use client";

import { useState } from 'react';

export default function PaneDecoder() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const b64e = () => setOutput(btoa(input));
  const b64d = () => { try { setOutput(atob(input)); } catch { setOutput('Invalid base64'); } };
  const urle = () => setOutput(encodeURIComponent(input));
  const urld = () => { try { setOutput(decodeURIComponent(input)); } catch { setOutput('Invalid URL encoding'); } };
  const hex = () => setOutput([...new TextEncoder().encode(input)].map(b=>b.toString(16).padStart(2,'0')).join(''));

  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <textarea readOnly value={output} className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent p-2 text-sm font-mono"/>
      <div className="col-span-2 flex gap-2 text-sm">
        <button onClick={b64e} className="px-2 py-1 border rounded">Base64 encode</button>
        <button onClick={b64d} className="px-2 py-1 border rounded">Base64 decode</button>
        <button onClick={urle} className="px-2 py-1 border rounded">URL encode</button>
        <button onClick={urld} className="px-2 py-1 border rounded">URL decode</button>
        <button onClick={hex} className="px-2 py-1 border rounded">Hex</button>
      </div>
    </div>
  );
}

