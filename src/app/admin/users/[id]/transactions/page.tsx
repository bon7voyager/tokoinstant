import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import OrderStatusBadge from "@/components/OrderStatus";
import { isPremium } from "@/lib/membership";
import { formatIDR, formatDate, cn } from "@/lib/utils";
import type {
  TopUpStatus,
  WithdrawalStatus,
  BalanceTxType,
  MembershipPurchaseStatus,
} from "@prisma/client";

export const dynamic = "force-dynamic";

const LIMIT = 10; // rows shown per history section

type Variant = Parameters<typeof Badge>[0]["variant"];

const TOPUP_STATUS: Record<TopUpStatus, { label: string; variant: Variant }> = {
  PENDING: { label: "Menunggu", variant: "main" },
  PAID: { label: "Berhasil", variant: "lime" },
  FAILED: { label: "Gagal", variant: "secondary" },
  EXPIRED: { label: "Kadaluarsa", variant: "white" },
};

const WD_STATUS: Record<WithdrawalStatus, { label: string; variant: Variant }> = {
  PENDING: { label: "Menunggu", variant: "main" },
  APPROVED: { label: "Disetujui", variant: "lime" },
  REJECTED: { label: "Ditolak", variant: "secondary" },
};

const LEDGER_TYPE: Record<BalanceTxType, { label: string; variant: Variant }> = {
  TOPUP: { label: "Top Up", variant: "lime" },
  PURCHASE: { label: "Pembelian", variant: "accent" },
  REFUND: { label: "Refund", variant: "grape" },
  WITHDRAWAL: { label: "Penarikan", variant: "main" },
  ADJUSTMENT: { label: "Penyesuaian", variant: "white" },
};

const MP_STATUS: Record<MembershipPurchaseStatus, { label: string; variant: Variant }> = {
  PENDING: { label: "Menunggu", variant: "main" },
  PAID: { label: "Lunas", variant: "lime" },
  FAILED: { label: "Gagal", variant: "secondary" },
  EXPIRED: { label: "Kadaluarsa", variant: "white" },
};

type MemEvent = {
  id: string;
  date: Date;
  badge: { label: string; variant: Variant };
  detail: string;
};

function Section({
  emoji,
  title,
  count,
  children,
}: {
  emoji: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="border-3 border-ink bg-white shadow-brutal">
      <div className="flex items-center justify-between gap-3 border-b-3 border-ink bg-paper px-4 py-3">
        <h2 className="font-display text-lg">
          {emoji} {title}
        </h2>
        <span className="text-xs font-bold uppercase text-ink/50">
          {count === LIMIT ? `${LIMIT} terbaru` : `${count} entri`}
        </span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm font-medium text-ink/40">{text}</p>;
}

export default async function UserTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const selected = await prisma.user.findUnique({
    where: { id },
    include: {
      topUps: { orderBy: { createdAt: "desc" }, take: LIMIT },
      orders: { include: { product: true }, orderBy: { createdAt: "desc" }, take: LIMIT },
      withdrawals: { orderBy: { createdAt: "desc" }, take: LIMIT },
      balanceTransactions: { orderBy: { createdAt: "desc" }, take: LIMIT },
      membershipLogs: { orderBy: { createdAt: "desc" }, take: LIMIT },
      membershipPurchases: { orderBy: { createdAt: "desc" }, take: LIMIT },
    },
  });
  if (!selected) notFound();

  // Unified membership history: admin grant/revoke (MembershipLog) + user purchases.
  const memEvents: MemEvent[] = [
    ...selected.membershipLogs.map((l) => ({
      id: `log-${l.id}`,
      date: l.createdAt,
      badge:
        l.action === "GRANT"
          ? { label: "Diberikan Admin", variant: "lime" as Variant }
          : { label: "Dicabut Admin", variant: "secondary" as Variant },
      detail:
        l.action === "GRANT"
          ? `+${l.days ?? 0} hari${l.note ? ` · ${l.note}` : ""}`
          : l.note ?? "Membership dinonaktifkan",
    })),
    ...selected.membershipPurchases.map((p) => ({
      id: `mp-${p.id}`,
      date: p.createdAt,
      badge: {
        label: `Pembelian · ${MP_STATUS[p.status].label}`,
        variant: MP_STATUS[p.status].variant,
      },
      detail: `${p.days} hari · ${p.payMethod === "BALANCE" ? "Saldo" : "Gateway"} · ${formatIDR(p.amount)}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, LIMIT);

  // Accurate lifetime totals (not capped by the per-section row limit).
  const [topupAgg, spentAgg, withdrawnAgg] = await Promise.all([
    prisma.topUp.aggregate({ _sum: { amount: true }, where: { userId: id, status: "PAID" } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { userId: id, status: "COMPLETED" } }),
    prisma.withdrawal.aggregate({ _sum: { amount: true }, where: { userId: id, status: "APPROVED" } }),
  ]);

  const stats = [
    { label: "Saldo", value: formatIDR(selected.balance), bg: "bg-grape text-white" },
    { label: "Total Top Up", value: formatIDR(topupAgg._sum.amount ?? 0), bg: "bg-lime" },
    { label: "Belanja Selesai", value: formatIDR(spentAgg._sum.total ?? 0), bg: "bg-main" },
    { label: "Total Tarik", value: formatIDR(withdrawnAgg._sum.amount ?? 0), bg: "bg-accent" },
  ];

  return (
    <div>
      <Link href="/admin/users" className="brutal-link text-sm">
        ← Kembali ke pengguna
      </Link>
      <h1 className="mt-4 font-display text-3xl">Riwayat Transaksi</h1>
      <p className="font-medium text-ink/60">Semua transaksi & aktivitas akun ini.</p>

      <div className="mt-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-3 border-ink bg-white p-5 shadow-brutal">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl">{selected.name}</span>
              {selected.role === "ADMIN" ? (
                <Badge variant="grape">Admin</Badge>
              ) : (
                <Badge variant="white">User</Badge>
              )}
              {isPremium(selected) && <Badge variant="lime">💎 Reseller</Badge>}
              {selected.isGuest && <Badge variant="white">👤 Tamu</Badge>}
            </div>
            <div className="mt-1 text-sm text-ink/60">{selected.email}</div>
            <div className="text-xs text-ink/40">Bergabung {formatDate(selected.createdAt)}</div>
          </div>
          <Link
            href={`/admin/users/${selected.id}/edit`}
            className="border-3 border-ink bg-accent px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm"
          >
            Kelola User
          </Link>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={cn("border-3 border-ink p-4 shadow-brutal", s.bg)}>
              <div className="text-xs font-bold uppercase tracking-wide opacity-70">{s.label}</div>
              <div className="mt-1 font-display text-xl">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Top Up history */}
        <Section emoji="💳" title="Riwayat Top Up" count={selected.topUps.length}>
          {selected.topUps.length === 0 ? (
            <Empty text="Belum ada top up." />
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {selected.topUps.map((t) => {
                  const s = TOPUP_STATUS[t.status];
                  return (
                    <tr key={t.id} className="border-b border-ink/10 last:border-0">
                      <td className="px-4 py-2.5 text-ink/70">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-2.5 font-bold">{formatIDR(t.amount)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink/60">
                        {t.paidAt ? formatDate(t.paidAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* Purchase history */}
        <Section emoji="🛒" title="Riwayat Pembelian" count={selected.orders.length}>
          {selected.orders.length === 0 ? (
            <Empty text="Belum ada pembelian." />
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-4 py-2.5">Invoice</th>
                  <th className="px-4 py-2.5">Produk</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Metode</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {selected.orders.map((o) => (
                  <tr key={o.id} className="border-b border-ink/10 last:border-0 align-top">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-xs underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                        title="Lihat detail pesanan ini"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {o.product.name}
                      {o.variantName ? <span className="text-ink/60"> — {o.variantName}</span> : null}
                      <div className="text-xs text-ink/50">x{o.quantity}</div>
                    </td>
                    <td className="px-4 py-2.5 font-bold">{formatIDR(o.total)}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-ink/60">
                      {o.payMethod === "BALANCE" ? "👛 Saldo" : "💳 Gateway"}
                    </td>
                    <td className="px-4 py-2.5">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink/60">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Withdrawal history */}
        <Section emoji="🏧" title="Riwayat Tarik Saldo" count={selected.withdrawals.length}>
          {selected.withdrawals.length === 0 ? (
            <Empty text="Belum ada penarikan." />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Nominal</th>
                  <th className="px-4 py-2.5">Tujuan</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {selected.withdrawals.map((w) => {
                  const s = WD_STATUS[w.status];
                  return (
                    <tr key={w.id} className="border-b border-ink/10 last:border-0 align-top">
                      <td className="px-4 py-2.5 text-ink/70">{formatDate(w.createdAt)}</td>
                      <td className="px-4 py-2.5 font-bold">{formatIDR(w.amount)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">
                          {w.method === "BANK" ? "🏦 Bank" : "📱 E-Wallet"}
                        </div>
                        <div className="text-xs">{w.accountName}</div>
                        <div className="font-mono text-xs">{w.accountNumber}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {w.adminNote && (
                          <div className="mt-1 text-xs text-ink/50">{w.adminNote}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* Membership history */}
        <Section emoji="💎" title="Riwayat Membership" count={memEvents.length}>
          {memEvents.length === 0 ? (
            <Empty text="Belum ada aktivitas membership." />
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Aktivitas</th>
                  <th className="px-4 py-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {memEvents.map((e) => (
                  <tr key={e.id} className="border-b border-ink/10 last:border-0 align-top">
                    <td className="px-4 py-2.5 text-ink/70">{formatDate(e.date)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={e.badge.variant}>{e.badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Wallet ledger */}
        <Section emoji="📒" title="Mutasi Saldo" count={selected.balanceTransactions.length}>
          {selected.balanceTransactions.length === 0 ? (
            <Empty text="Belum ada mutasi saldo." />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Tipe</th>
                  <th className="px-4 py-2.5">Jumlah</th>
                  <th className="px-4 py-2.5">Saldo Akhir</th>
                  <th className="px-4 py-2.5">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {selected.balanceTransactions.map((b) => {
                  const t = LEDGER_TYPE[b.type];
                  return (
                    <tr key={b.id} className="border-b border-ink/10 last:border-0 align-top">
                      <td className="px-4 py-2.5 text-ink/70">{formatDate(b.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={t.variant}>{t.label}</Badge>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 font-bold",
                          b.amount >= 0 ? "text-ink" : "text-secondary",
                        )}
                      >
                        {b.amount >= 0 ? "+" : "−"} {formatIDR(Math.abs(b.amount))}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{formatIDR(b.balanceAfter)}</td>
                      <td className="px-4 py-2.5 text-xs text-ink/60">{b.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
