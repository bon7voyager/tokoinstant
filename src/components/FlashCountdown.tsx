"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days > 0 ? `${days}h ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Live ticking countdown to `endsAt`. Renders a dash until mounted (so the
 * server-rendered HTML matches and there's no hydration mismatch). */
export default function FlashCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return <span className="font-mono font-bold tabular-nums">—</span>;
  const left = new Date(endsAt).getTime() - now;
  return <span className="font-mono font-bold tabular-nums">{format(left)}</span>;
}
