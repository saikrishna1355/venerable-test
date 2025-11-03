"use client";

import { useState } from "react";
import CollapsibleSection from "./ui/CollapsibleSection";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const openViaPuppeteer = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/puppeteer/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          bypassCSP: true,
          chromiumOnly: false,
          headless: false,
          devtools: false,
          viaProxy: true,
          fallbackDirect: true,
        }),
      });
      const t = await r.text();
      if (!r.ok) {
        setMsg("Failed: " + t);
      } else {
        try {
          const j = JSON.parse(t);
          setMsg(
            `Opened in Puppeteer (${
              j.usedProxy ? "via MITM proxy :8081" : "direct"
            }).`
          );
        } catch {
          setMsg("Opened in Puppeteer.");
        }
      }
    } catch (e: any) {
      setMsg("Error: " + (e?.message || String(e)));
    }
    setLoading(false);
  };

  return (
    <>
      <SpeedInsights />
      <div className="min-h-[calc(100dvh-48px)] w-screen bg-gradient-to-b from-[var(--bg-grad-from)] to-[var(--bg-grad-to)] text-[var(--foreground)] flex items-start justify-center p-6 transition-colors">
        <div className="w-full max-w-3xl">
          <CollapsibleSection
            title="Open Target in Chromium (Puppeteer)"
            defaultOpen={true}
            className="panel shadow-lg backdrop-blur"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://target.example/"
                className="flex-1 input px-3 py-2 text-sm w-full"
              />
              <button
                onClick={openViaPuppeteer}
                disabled={loading}
                className="btn btn-primary px-3 py-2 text-sm disabled:opacity-50 w-full sm:w-auto"
              >
                {loading ? "Opening…" : "Open via Puppeteer"}
              </button>
            </div>
            {msg && (
              <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                {msg}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </>
  );
}
