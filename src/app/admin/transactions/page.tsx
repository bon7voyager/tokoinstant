import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate, cn } from "@/lib/utils";
import type {
  OrderStatus,
  TopUpStatus,
  WithdrawalStatus,
  MembershipPurchaseStatus,
  Role,
} from "@prisma/client";

export const dynamic = "force-dynamic";

type Variant = Parameters<typeof Badge>[0]["variant"];

const FILTERS = [
  { key: "ALL", label: "Semua" },
  { key: "ORDER", label: "Pembelian" },
  { key: "TOPUP", label: "Top Up" },
  { key: "WITHDRAWAL", label: "Tarik Saldo" },
  { key: "MEMBERSHIP", label: "Membership" },
  { key: "REFUND", label: "Refund" },
  { key: "ADJUSTMENT", label: "Penyesuaian" },
] as const;

type FeedKey = (typeof FILTERS)[number]["key"];

// Pull more per source than one page so the merged/sorted window is correct across
// several pages of the feed.
const PER_SOURCE = 150;
const PAGE_SIZE = 10;

const ORDER_LABEL: Record<OrderStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Diproses",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  EXPIRED: "Kadaluarsa",
  REFUNDED: "Refund",
};
const TOPUP_LABEL: Record<TopUpStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Berhasil",
  FAILED: "Gagal",
  EXPIRED: "Kadaluarsa",
};
const WD_LABEL: Record<WithdrawalStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};
const MP_LABEL: Record<MembershipPurchaseStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kadaluarsa",
};

type FeedEvent = {
  id: string;
  date: Date;
  user: { id: string; name: string; role: Role; isGuest: boolean };
  badge: { label: string; variant: Variant };
  detail: string;
  amount: number | null; // displayed magnitude (IDR); null = no money moved
  href?: string;
};

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { type, page: pageRaw } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === type)?.key ?? "ALL") as FeedKey;
  const want = (k: FeedKey) => filter === "ALL" || filter === k;

  const userSel = { select: { id: true, name: true, role: true, isGuest: true } };

  const [orders, topups, withdrawals, memPurchases, memLogs, refunds, adjustments] =
    await Promise.all([
      want("ORDER")
        ? prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { product: { select: { name: true } }, user: userSel },
          })
        : [],
      want("TOPUP")
        ? prisma.topUp.findMany({
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
      want("WITHDRAWAL")
        ? prisma.withdrawal.findMany({
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
      want("MEMBERSHIP")
        ? prisma.membershipPurchase.findMany({
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
      want("MEMBERSHIP")
        ? prisma.membershipLog.findMany({
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
      // REFUND credits (order refund / rejected withdrawal) exist ONLY in the ledger —
      // no standalone source table — so they must be pulled from BalanceTransaction.
      want("REFUND")
        ? prisma.balanceTransaction.findMany({
            where: { type: "REFUND" },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
      // Only ADJUSTMENT here: TOPUP/PURCHASE/WITHDRAWAL ledger rows already have their
      // own source rows above, so including them would double-count.
      want("ADJUSTMENT")
        ? prisma.balanceTransaction.findMany({
            where: { type: "ADJUSTMENT" },
            orderBy: { createdAt: "desc" },
            take: PER_SOURCE,
            include: { user: userSel },
          })
        : [],
    ]);

  const events: FeedEvent[] = [
    ...orders.map((o) => ({
      id: `o-${o.id}`,
      date: o.createdAt,
      user: o.user,
      badge: { label: "Pembelian", variant: "accent" as Variant },
      detail: `${o.product.name}${o.variantName ? ` — ${o.variantName}` : ""} · ${ORDER_LABEL[o.status]}`,
      amount: o.total,
      href: `/admin/orders/${o.id}`,
    })),
    ...topups.map((t) => ({
      id: `t-${t.id}`,
      date: t.createdAt,
      user: t.user,
      badge: { label: "Top Up", variant: "lime" as Variant },
      detail: `Top up saldo · ${TOPUP_LABEL[t.status]}`,
      amount: t.amount,
    })),
    ...withdrawals.map((w) => ({
      id: `w-${w.id}`,
      date: w.createdAt,
      user: w.user,
      badge: { label: "Tarik Saldo", variant: "main" as Variant },
      detail: `${w.method === "BANK" ? "🏦 Bank" : "📱 E-Wallet"} · ${WD_LABEL[w.status]}`,
      amount: w.amount,
    })),
    ...memPurchases.map((p) => ({
      id: `mp-${p.id}`,
      date: p.createdAt,
      user: p.user,
      badge: { label: "Beli Membership", variant: "grape" as Variant },
      detail: `${p.days} hari · ${p.payMethod === "BALANCE" ? "Saldo" : "Gateway"} · ${MP_LABEL[p.status]}`,
      amount: p.amount,
    })),
    ...memLogs.map((l) => ({
      id: `ml-${l.id}`,
      date: l.createdAt,
      user: l.user,
      badge:
        l.action === "GRANT"
          ? { label: "Membership +", variant: "lime" as Variant }
          : { label: "Membership −", variant: "secondary" as Variant },
      detail:
        l.action === "GRANT"
          ? `+${l.days ?? 0} hari${l.note ? ` · ${l.note}` : ""}`
          : l.note ?? "Membership dicabut admin",
      amount: null,
    })),
    ...refunds.map((b) => ({
      id: `ref-${b.id}`,
      date: b.createdAt,
      user: b.user,
      badge: { label: "Refund", variant: "grape" as Variant },
      detail: `Saldo dikembalikan${b.note ? ` · ${b.note}` : ""}`,
      amount: Math.abs(b.amount),
    })),
    ...adjustments.map((b) => ({
      id: `adj-${b.id}`,
      date: b.createdAt,
      user: b.user,
      badge: { label: "Penyesuaian", variant: "white" as Variant },
      detail: `${b.amount >= 0 ? "Tambah" : "Kurang"} saldo oleh admin${b.note ? ` · ${b.note}` : ""}`,
      amount: Math.abs(b.amount),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const total = events.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const baseHref = filter === "ALL" ? "/admin/transactions" : `/admin/transactions?type=${filter}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Log Transaksi</h1>
      <p className="font-medium text-ink/60">
        Semua aktivitas transaksi pengguna &amp; admin — pantau traffic toko.
      </p>

      {/* Type filter */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "ALL" ? "/admin/transactions" : `/admin/transactions?type=${f.key}`}
            className={cn(
              "border-3 border-ink px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm",
              filter === f.key ? "bg-main" : "bg-white",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Aktivitas</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada transaksi.
                </td>
              </tr>
            ) : (
              pageEvents.map((e) => (
                <tr key={e.id} className="border-b border-ink/10 last:border-0 align-top">
                  <td className="px-4 py-3 text-xs text-ink/60 whitespace-nowrap">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/admin/users/${e.user.id}/transactions`}
                        className="font-medium underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                        title="Lihat riwayat transaksi pengguna ini"
                      >
                        {e.user.name}
                      </Link>
                      {e.user.role === "ADMIN" ? (
                        <Badge variant="grape">Admin</Badge>
                      ) : e.user.isGuest ? (
                        <Badge variant="white">👤 Tamu</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.badge.variant}>{e.badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {e.href ? (
                      <Link
                        href={e.href}
                        className="underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                      >
                        {e.detail}
                      </Link>
                    ) : (
                      e.detail
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                    {e.amount === null ? "—" : formatIDR(e.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />

      <p className="mt-3 text-xs font-medium text-ink/50">
        Total {total} aktivitas. Urut berdasarkan waktu transaksi dibuat.
      </p>
    </div>
  );
}
