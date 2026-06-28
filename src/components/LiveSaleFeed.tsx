"use client";

import { useEffect, useRef, useState } from "react";
import { getRecentSalesAction, type RecentSale } from "@/app/actions/public";
import { productVisual } from "@/components/ProductCard";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

export default function LiveSaleFeed() {
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Load + periodically refresh the feed.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getRecentSalesAction();
        if (active) setSales(data);
      } catch {
        /* ignore */
      }
    };
    load();
    const refresh = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(refresh);
    };
  }, []);

  // Rotation loop: show ~6s, hide ~5s, advance.
  useEffect(() => {
    if (dismissed || sales.length === 0) return;
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const cycle = () => {
      setShown(true);
      timers.current.push(
        setTimeout(() => {
          setShown(false);
          timers.current.push(
            setTimeout(() => {
              setIdx((i) => (i + 1) % sales.length);
              cycle();
            }, 5000),
          );
        }, 6000),
      );
    };
    // small initial delay so it doesn't pop instantly on load
    timers.current.push(setTimeout(cycle, 2500));
    return clearAll;
    // Depend on length (not the array identity) so the 30s refetch doesn't
    // tear down and restart the rotation cycle on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.length, dismissed]);

  if (dismissed || sales.length === 0) return null;
  const sale = sales[idx % sales.length];
  if (!sale) return null;
  const isMembership = sale.kind === "membership";
  const visual = isMembership
    ? { emoji: "💎", bg: "bg-grape" }
    : productVisual(sale.product);

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 w-[min(20rem,calc(100vw-2rem))] transition-all duration-300 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 border-3 border-ink bg-white p-3 shadow-brutal-lg">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center border-3 border-ink ${visual.bg} text-xl`}
        >
          {visual.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight">
            <span className="font-bold">{sale.name}</span>{" "}
            {isMembership ? (
              <>
                baru saja jadi <span className="font-bold">Member Reseller 💎</span>
              </>
            ) : (
              <>
                baru saja membeli <span className="font-bold">{sale.product}</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink/50">
            ✓ Terverifikasi · {timeAgo(sale.paidAt)}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Tutup"
          className="shrink-0 border-3 border-ink bg-white px-1.5 text-xs font-bold leading-none shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
