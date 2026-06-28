import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import WithdrawAdminActions from "@/components/WithdrawAdminActions";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate, cn } from "@/lib/utils";
import type { WithdrawalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
const STATUS: Record<WithdrawalStatus, { label: string; variant: "main" | "lime" | "secondary" }> = {
  PENDING: { label: "Menunggu", variant: "main" },
  APPROVED: { label: "Disetujui", variant: "lime" },
  REJECTED: { label: "Ditolak", variant: "secondary" },
};

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageRaw } = await searchParams;
  const filter = status && status !== "ALL" ? (status as WithdrawalStatus) : undefined;
  const where = filter ? { status: filter } : {};

  const total = await prisma.withdrawal.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const [withdrawals, pendingAgg] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.withdrawal.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: "PENDING" },
    }),
  ]);

  // Anti-fraud: surface withdrawal destinations shared by multiple distinct users
  // (a classic referral-farming cash-out pattern). Normalize the account number so
  // "1234 5678" and "1234-5678" collide. Cheap for a shop-sized table.
  const normAcct = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const allDest = await prisma.withdrawal.findMany({ select: { userId: true, accountNumber: true } });
  const acctUsers = new Map<string, Set<string>>();
  for (const d of allDest) {
    const k = normAcct(d.accountNumber);
    if (!k) continue;
    if (!acctUsers.has(k)) acctUsers.set(k, new Set());
    acctUsers.get(k)!.add(d.userId);
  }

  const baseHref = `/admin/withdrawals${status ? `?status=${status}` : ""}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Penarikan Saldo</h1>
      <p className="font-medium text-ink/60">
        Setujui (setelah transfer manual) atau tolak (saldo dikembalikan). Menunggu:{" "}
        <b>{pendingAgg._count}</b> permintaan · <b>{formatIDR(pendingAgg._sum.amount ?? 0)}</b>
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/withdrawals?status=${f}`}
            className={cn(
              "border-3 border-ink px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm",
              (status ?? "ALL") === f ? "bg-main" : "bg-white",
            )}
          >
            {f === "ALL" ? "Semua" : STATUS[f as WithdrawalStatus].label}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Nominal</th>
              <th className="px-4 py-3">Tujuan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-ink/50">
                  Tidak ada permintaan penarikan.
                </td>
              </tr>
            ) : (
              withdrawals.map((w) => {
                const s = STATUS[w.status];
                const sharedBy = acctUsers.get(normAcct(w.accountNumber))?.size ?? 1;
                return (
                  <tr key={w.id} className="border-b border-ink/10 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{w.user.name}</div>
                      <div className="text-xs text-ink/50">{w.user.email}</div>
                    </td>
                    <td className="px-4 py-3 font-display">{formatIDR(w.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {w.method === "BANK" ? "🏦 Bank" : "📱 E-Wallet"}
                      </div>
                      <div className="text-xs">{w.accountName}</div>
                      <div className="font-mono text-xs">{w.accountNumber}</div>
                      {sharedBy > 1 && (
                        <div className="mt-1 inline-block border-2 border-ink bg-secondary px-1.5 text-[10px] font-bold uppercase text-white">
                          ⚠ Dipakai {sharedBy} akun
                        </div>
                      )}
                      {w.note && <div className="text-xs text-ink/50">“{w.note}”</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      {w.adminNote && (
                        <div className="mt-1 text-xs text-ink/50">{w.adminNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/60">
                      {formatDate(w.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {w.status === "PENDING" ? (
                        <WithdrawAdminActions id={w.id} />
                      ) : (
                        <span className="text-xs text-ink/40">Selesai</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
    </div>
  );
}
