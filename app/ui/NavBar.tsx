"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";

export default function NavBar() {
  const [intercept, setIntercept] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/intercept/toggle");
      const d = await r.json();
      setIntercept(!!d.enabled);
    } catch {}
  };

  useEffect(() => {
    setMounted(true);
    load();
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/intercept/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !intercept }),
      });
      const d = await r.json();
      setIntercept(!!d.enabled);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/40 border-b border-zinc-200/70 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center gap-3">
        <Link href="/" className="font-semibold tracking-tight">
          Injector
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/intercept" className="btn btn-ghost tiny">
            Intercept
          </Link>
          <Link href="/repeater" className="btn btn-ghost tiny">
            Repeater
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`chip ${intercept ? "" : ""}`}
            style={{
              background: intercept ? "var(--accent)" : "transparent",
              color: intercept
                ? "var(--accent-foreground)"
                : "var(--foreground)",
              borderColor: intercept ? "var(--accent)" : "var(--border)",
            }}
          >
            {intercept ? "Intercept ON" : "Intercept OFF"}
          </span>
          <button
            onClick={toggle}
            disabled={!mounted || busy}
            className="btn tiny disabled:opacity-50"
          >
            {intercept ? "Turn off" : "Turn on"}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
