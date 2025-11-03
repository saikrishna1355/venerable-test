"use client";

import { useEffect, useState } from 'react';

type Rule = {
  id: string;
  hostPattern: string;
  pathPattern?: string;
  enabled: boolean;
  actions: { stripCSP?: boolean; stripXFO?: boolean; injectCSP?: string };
};

export default function PaneRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [hostPattern, setHostPattern] = useState('');
  const [stripCSP, setStripCSP] = useState(true);
  const [stripXFO, setStripXFO] = useState(true);
  const [injectCSP, setInjectCSP] = useState("frame-ancestors 'self' *; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
  const [token, setToken] = useState('');

  const load = async () => {
    const r = await fetch('/api/rules');
    const d = await r.json();
    setRules(d.rules || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const r = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hostPattern, enabled: true, actions: { stripCSP, stripXFO, injectCSP } }),
    });
    if (r.ok) load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    const r = await fetch('/api/rules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, enabled })
    });
    if (r.ok) load();
  };

  const del = async (id: string) => {
    const r = await fetch(`/api/rules?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) load();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-zinc-500">Admin token required for changes. Set env var ADMIN_TOKEN for the server, then paste here.</div>
      <input value={token} onChange={(e)=>setToken(e.target.value)} placeholder="Admin token" className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm w-80"/>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded p-2 border-zinc-300 dark:border-zinc-800">
          <div className="text-sm font-medium mb-2">Add Rule</div>
          <div className="flex flex-col gap-2 text-sm">
            <input value={hostPattern} onChange={(e)=>setHostPattern(e.target.value)} placeholder="Host contains (e.g., example.com)" className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1"/>
            <label className="flex items-center gap-2"><input type="checkbox" checked={stripCSP} onChange={(e)=>setStripCSP(e.target.checked)}/>Strip CSP</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={stripXFO} onChange={(e)=>setStripXFO(e.target.checked)}/>Strip X-Frame-Options</label>
            <div>
              <div className="text-xs mb-1">Inject CSP</div>
              <input value={injectCSP} onChange={(e)=>setInjectCSP(e.target.value)} className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1"/>
            </div>
            <div>
              <button onClick={add} className="px-3 py-1 border rounded">Add</button>
            </div>
          </div>
        </div>
        <div className="border rounded p-2 border-zinc-300 dark:border-zinc-800">
          <div className="text-sm font-medium mb-2">Rules</div>
          <table className="w-full text-sm">
            <thead><tr><th className="text-left p-1">Host</th><th className="text-left p-1">Actions</th><th className="text-left p-1 w-16">On</th><th className="text-left p-1 w-16">Del</th></tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="p-1">{r.hostPattern}</td>
                  <td className="p-1 text-xs">{r.actions.stripCSP?'stripCSP ':''}{r.actions.stripXFO?'stripXFO ':''}{r.actions.injectCSP?'injectCSP':''}</td>
                  <td className="p-1"><input type="checkbox" checked={r.enabled} onChange={(e)=>toggle(r.id, e.target.checked)}/></td>
                  <td className="p-1"><button onClick={()=>del(r.id)} className="text-xs px-2 py-1 border rounded">X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

