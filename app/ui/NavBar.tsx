"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import Portal from "./Portal";

export default function NavBar() {
  const [intercept, setIntercept] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSmall, setIsSmall] = useState(false);

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

  // Track viewport to gate the mobile menu button (in case CSS variants misbehave)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767.98px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // MediaQueryListEvent on modern browsers; initial is MediaQueryList
      // @ts-ignore-next-line
      setIsSmall((e.matches !== undefined ? e.matches : mq.matches) as boolean);
    };
    setIsSmall(mq.matches);
    // Add listener with fallback for older browsers
    try { mq.addEventListener('change', onChange as any); } catch { try { mq.addListener(onChange as any); } catch {} }
    return () => { try { mq.removeEventListener('change', onChange as any); } catch { try { mq.removeListener(onChange as any); } catch {} } };
  }, []);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center gap-2 sm:gap-3 flex-nowrap">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <Link href="/" className="font-semibold tracking-tight shrink-0">
            Injector
          </Link>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-2 text-sm">
            <Link href="/intercept" className="btn btn-ghost tiny shrink-0">Intercept</Link>
            <Link href="/repeater" className="btn btn-ghost tiny shrink-0">Repeater</Link>
          </nav>
        </div>
        {/* Mobile menu button (rendered only on small viewports) */}
        {isSmall && (
          <button
            className="ml-auto btn tiny h-8 w-8 p-0 flex items-center justify-center"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${menuOpen ? 'translate-y-1.5 rotate-45' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-current my-1 transition-opacity duration-200 ${menuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
            <span className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${menuOpen ? '-translate-y-1.5 -rotate-45' : ''}`}></span>
          </button>
        )}
        {/* Desktop controls */}
        <div className="ml-auto hidden sm:flex items-center gap-2 justify-end shrink-0">
          <span
            className={`chip ${intercept ? "" : ""}`}
            style={{
              background: intercept ? "var(--accent)" : "transparent",
              color: intercept ? "var(--accent-foreground)" : "var(--foreground)",
              borderColor: intercept ? "var(--accent)" : "var(--border)",
            }}
          >
            {intercept ? "Intercept ON" : "Intercept OFF"}
          </span>
          <button onClick={toggle} disabled={!mounted || busy} className="btn tiny disabled:opacity-50">
            {intercept ? "Turn off" : "Turn on"}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile modal menu */}
      {menuOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
            aria-modal="true"
            role="dialog"
          >
            <div
              className="panel w-full max-w-sm max-h-[80vh] overflow-auto rounded-xl p-4 shadow-xl bg-[var(--background)] text-[var(--foreground)] animate-pop"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Menu</div>
                <button className="btn tiny" onClick={() => setMenuOpen(false)}>Close</button>
              </div>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link href="/intercept" className="btn btn-ghost tiny w-full justify-start" onClick={() => setMenuOpen(false)}>Intercept</Link>
                </li>
                <li>
                  <Link href="/repeater" className="btn btn-ghost tiny w-full justify-start" onClick={() => setMenuOpen(false)}>Repeater</Link>
                </li>
                <li className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
                <li className="flex items-center justify-between">
                  <div className="text-sm">Intercept</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`chip ${intercept ? "" : ""}`}
                      style={{
                        background: intercept ? "var(--accent)" : "transparent",
                        color: intercept ? "var(--accent-foreground)" : "var(--foreground)",
                        borderColor: intercept ? "var(--accent)" : "var(--border)",
                      }}
                    >
                      {intercept ? "ON" : "OFF"}
                    </span>
                    <button onClick={async ()=>{ await toggle(); setMenuOpen(false); }} disabled={!mounted || busy} className="btn tiny disabled:opacity-50">
                      {intercept ? "Turn off" : "Turn on"}
                    </button>
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <div className="text-sm">Theme</div>
                  <ThemeToggle />
                </li>
              </ul>
            </div>
          </div>
        </Portal>
      )}
    </header>
  );
}
