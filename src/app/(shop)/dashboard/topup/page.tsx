import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { topupBounds } from "@/lib/wallet";
import { Alert, Badge } from "@/components/ui";
import TopUpForm from "@/components/TopUpForm";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate } from "@/lib/utils";
import type { BalanceTxType } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<BalanceTxType, { label: string; variant: "lime" | "secondary" | "accent" | "grape" }> = {
  TOPUP: { label: "Top Up", variant: "lime" },
  PURCHASE: { label: "Belanja", variant: "secondary" },
  REFUND: { label: "Refund", variant: "accent" },
  WITHDRAWAL: { label: "Penarikan", variant: "secondary" },
  ADJUSTMENT: { label: "Penyesuaian", variant: "grape" },
};

export default async function TopUpPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; pending?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/topup");

  const { success, pending, page: pageRaw } = await searchParams;
  const { presets, min, max } = topupBounds();

  const totalHistory = await prisma.balanceTransaction.count({ where: { userId: user.id } });
  const totalPages = Math.max(1, Math.ceil(totalHistory / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const history = await prisma.balanceTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="brutal-link text-sm">
          ← Kembali ke dashboard
        </Link>
        <Link href="/dashboard/withdraw" className="brutal-link text-sm">
          Tarik Saldo →
        </Link>
      </div>

      <div className="mt-5 space-y-5">
        {/* Balance */}
          <div className="border-3 border-ink bg-lime p-6 shadow-brutal">
            <div className="text-sm font-bold uppercase tracking-wide text-ink/70">
              Saldo Kamu
            </div>
            <div className="mt-1 font-display text-4xl">{formatIDR(user.balance)}</div>
          </div>

          <div className="border-3 border-ink bg-white p-6 shadow-brutal">
            <h1 className="mb-4 font-display text-xl">Top Up Saldo</h1>
            {success && <div className="mb-3"><Alert tone="success">Top up berhasil! Saldo sudah bertambah.</Alert></div>}
            {pending && <div className="mb-3"><Alert tone="info">Menunggu pembayaran. Saldo bertambah otomatis setelah lunas.</Alert></div>}
            <TopUpForm presets={presets} min={min} max={max} />
          </div>

        {/* History */}
        <div id="riwayat" className="scroll-mt-24 border-3 border-ink bg-white p-6 shadow-brutal">
          <h2 className="mb-4 font-display text-xl">Riwayat Saldo</h2>
          {totalHistory === 0 ? (
            <p className="text-sm font-medium text-ink/50">Belum ada transaksi saldo.</p>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => {
                const meta = TYPE_LABEL[tx.type];
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 border-3 border-ink bg-paper px-3 py-2"
                  >
                    <div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <div className="mt-1 text-xs text-ink/50">{formatDate(tx.createdAt)}</div>
                      {tx.note && <div className="text-xs text-ink/60">{tx.note}</div>}
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${tx.amount >= 0 ? "text-ink" : "text-secondary"}`}>
                        {tx.amount >= 0 ? "+" : "−"} {formatIDR(Math.abs(tx.amount))}
                      </div>
                      <div className="text-xs text-ink/50">Saldo: {formatIDR(tx.balanceAfter)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref="/dashboard/topup"
            hash="riwayat"
          />
        </div>
      </div>
    </div>
  );
}
