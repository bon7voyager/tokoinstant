"use client";

import { useEffect, useRef, useState } from "react";

export type Stat = { value: number; suffix?: string; label: string; bg: string };

function Counter({ stat }: { stat: Stat }) {
  const [display, setDisplay] = useState(stat.value); // SSR/no-JS shows final value
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;

    // Honour reduced-motion: keep the final value, skip the count-up animation.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    setDisplay(0); // start from 0 only when JS animation will run
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !ran.current) {
            ran.current = true;
            const duration = 1200;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setDisplay(Math.round(stat.value * eased));
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stat.value]);

  return (
    <div
      ref={ref}
      className={`border-3 border-ink ${stat.bg} p-4 text-center shadow-brutal sm:p-6`}
    >
      <div className="font-display text-3xl sm:text-4xl">
        {display.toLocaleString("id-ID")}
        {stat.suffix ?? ""}
      </div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide opacity-80 sm:text-sm">
        {stat.label}
      </div>
    </div>
  );
}

export function StatsCounter({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <Counter key={s.label} stat={s} />
      ))}
    </div>
  );
}
