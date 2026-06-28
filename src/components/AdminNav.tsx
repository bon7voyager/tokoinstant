"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; emoji: string; color: string };
type Group = { title?: string; items: Item[] };

// Grouped like a real admin panel: a top "overview" block, then sections.
const GROUPS: Group[] = [
  {
    items: [
      { href: "/admin", label: "Ringkasan", emoji: "📊", color: "bg-main" },
      { href: "/admin/earnings", label: "Penghasilan", emoji: "💰", color: "bg-lime" },
    ],
  },
  {
    title: "Master Data",
    items: [
      { href: "/admin/products", label: "Produk", emoji: "🛍️", color: "bg-secondary" },
      { href: "/admin/stock", label: "Stok", emoji: "📦", color: "bg-accent" },
      { href: "/admin/users", label: "Pengguna", emoji: "👥", color: "bg-secondary" },
      { href: "/admin/membership", label: "Reseller", emoji: "💎", color: "bg-grape" },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { href: "/admin/orders", label: "Pesanan", emoji: "🧾", color: "bg-lime" },
      { href: "/admin/manual", label: "Pesanan Manual", emoji: "📨", color: "bg-accent" },
      { href: "/admin/balances", label: "Saldo", emoji: "👛", color: "bg-grape" },
      { href: "/admin/withdrawals", label: "Penarikan", emoji: "🏧", color: "bg-main" },
      { href: "/admin/referrals", label: "Referral", emoji: "🎁", color: "bg-grape" },
      { href: "/admin/transactions", label: "Log Transaksi", emoji: "📜", color: "bg-bubble" },
    ],
  },
  {
    title: "Lainnya",
    items: [
      { href: "/admin/coupons", label: "Kupon", emoji: "🎟️", color: "bg-bubble" },
      { href: "/admin/flash-sale", label: "Flash Sale", emoji: "⚡", color: "bg-secondary" },
      { href: "/admin/notifications", label: "Notifikasi", emoji: "🔔", color: "bg-accent" },
      { href: "/admin/settings", label: "Pengaturan", emoji: "⚙️", color: "bg-lime" },
    ],
  },
];

const STORAGE_KEY = "adminNavCollapsed";

export default function AdminNav({
  badges,
}: {
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Avoid animating the width on the very first paint (after we read the
  // saved/responsive default) so there's no slide-in flash on load.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setCollapsed(saved === "1");
    else setCollapsed(window.innerWidth < 1024); // default: collapsed on small screens
    // enable transitions only after the initial state is applied
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "shrink-0",
        animate && "transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-60",
      )}
    >
      {/* Fixed to the viewport height with its own scrollbar — the menu no longer
          rides along when the page content on the right scrolls. */}
      <div className="sticky top-[5.5rem] max-h-[calc(100vh-6.5rem)] overflow-y-auto border-3 border-ink bg-ink p-2.5 shadow-brutal">
        {/* Header: title + collapse toggle */}
        <div className={cn("mb-2 flex items-center gap-1 px-0.5", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <span className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-paper/50">
              Menu Admin
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Perbesar menu" : "Perkecil menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Perbesar menu" : "Perkecil menu"}
            className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-paper bg-main font-bold text-ink shadow-[2px_2px_0_0_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav aria-label="Menu admin" className="flex flex-col gap-2">
          {GROUPS.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-1.5">
              {g.title &&
                (collapsed ? (
                  gi > 0 && <div className="mx-1 my-0.5 border-t border-paper/15" />
                ) : (
                  <div className="px-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-paper/40">
                    {g.title}
                  </div>
                ))}
              {g.items.map((l) => {
                const active =
                  l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
                const count = badges?.[l.href] ?? 0;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    title={
                      collapsed
                        ? count > 0
                          ? `${l.label} (${count})`
                          : l.label
                        : undefined
                    }
                    className={cn(
                      "group flex items-center gap-2.5 border-3 border-ink py-2 text-sm font-bold transition-all",
                      collapsed ? "justify-center px-0" : "px-2",
                      active
                        ? "bg-main text-ink shadow-brutal-sm"
                        : "bg-white text-ink hover:-translate-y-0.5 hover:shadow-brutal-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "relative flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink text-base shadow-[2px_2px_0_0_#111] transition-transform group-hover:-rotate-6",
                        active ? "bg-[#fff]" : l.color,
                      )}
                    >
                      {l.emoji}
                      {/* Collapsed: count rides the corner of the icon. */}
                      {collapsed && count > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center border border-ink bg-secondary px-0.5 text-[9px] font-bold leading-none text-white">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{l.label}</span>}
                    {/* Expanded: count pill at the row's end. */}
                    {!collapsed && count > 0 && (
                      <span className="ml-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center border-2 border-ink bg-secondary px-1 text-[11px] font-bold leading-none text-white">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
