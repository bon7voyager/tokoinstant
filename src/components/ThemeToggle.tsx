"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The actual class is applied pre-paint by an inline script in
 * the root layout (no flash); this just flips it and persists the choice.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={dark ? "Mode terang" : "Mode gelap"}
      className="flex h-9 w-9 shrink-0 items-center justify-center border-3 border-ink bg-surface text-lg shadow-brutal-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
    >
      {/* Neutral icon until mounted to avoid hydration mismatch */}
      <span suppressHydrationWarning>{mounted ? (dark ? "☀️" : "🌙") : "🌙"}</span>
    </button>
  );
}
