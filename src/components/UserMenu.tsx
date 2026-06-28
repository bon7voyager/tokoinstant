"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { formatIDR } from "@/lib/utils";

type MenuUser = {
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  balance: number;
  premium: boolean;
};

export default function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = user.name?.[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const items: { href: string; emoji: string; label: string }[] = [
    { href: "/dashboard#profil", emoji: "👤", label: "Profil Saya" },
    { href: "/dashboard/orders", emoji: "🧾", label: "Pesanan Saya" },
    { href: "/dashboard/topup", emoji: "👛", label: "Top Up Saldo" },
    { href: "/dashboard/withdraw", emoji: "🏧", label: "Tarik Saldo" },
    {
      href: "/dashboard/upgrade",
      emoji: user.premium ? "💎" : "⭐",
      label: user.premium ? "Membership Reseller" : "Upgrade Reseller",
    },
    { href: "/dashboard/referral", emoji: "🎁", label: "Referral" },
    { href: "/leaderboard", emoji: "🏆", label: "Leaderboard" },
  ];
  if (user.role === "ADMIN") {
    items.push({ href: "/admin", emoji: "🛡️", label: "Panel Admin" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 border-3 border-ink bg-white px-2 py-1.5 font-bold text-ink shadow-brutal-sm transition-transform hover:-translate-y-0.5"
      >
        <span className="flex h-7 w-7 items-center justify-center border-3 border-ink bg-secondary font-display text-sm text-white">
          {initial}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{user.name}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 border-3 border-ink bg-white shadow-brutal-lg"
        >
          {/* Header: name + email */}
          <div className="flex items-center gap-3 border-b-3 border-ink bg-main p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-ink bg-secondary font-display text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-bold leading-tight">{user.name}</span>
                {user.premium && (
                  <span className="shrink-0 border-2 border-ink bg-grape px-1.5 text-[10px] font-bold uppercase text-white">
                    💎 Reseller
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-ink/60">{user.email}</div>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between border-b-3 border-ink px-3 py-2.5">
            <span className="text-sm font-bold uppercase tracking-wide text-ink/60">
              Saldo
            </span>
            <span className="font-display text-lg">{formatIDR(user.balance)}</span>
          </div>

          {/* Links */}
          <nav className="p-1.5">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 font-bold transition-colors hover:bg-main"
                role="menuitem"
              >
                <span>{it.emoji}</span>
                <span>{it.label}</span>
              </Link>
            ))}
          </nav>

          {/* Logout */}
          <form action={logoutAction} className="border-t-3 border-ink p-1.5">
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-bold transition-colors hover:bg-secondary hover:text-white"
              role="menuitem"
            >
              <span>🚪</span>
              <span>Keluar</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
