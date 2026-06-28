"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Live payment countdown. Refreshes the page when the deadline passes so the
 * server can show the (now expired/cancelled) state. */
export default function OrderCountdown({ deadline }: { deadline: string }) {
  const router = useRouter();
  const target = new Date(deadline).getTime();
  const [left, setLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const ms = target - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  if (left <= 0) {
    return <span className="font-bold text-secondary">Waktu habis…</span>;
  }

  const totalSec = Math.floor(left / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="font-display tabular-nums">
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`}
    </span>
  );
}
