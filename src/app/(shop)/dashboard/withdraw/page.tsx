import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { withdrawBounds, referralLockedBalance } from "@/lib/wallet";
import { Alert, Badge } from "@/components/ui";
import WithdrawForm from "@/components/WithdrawForm";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate } from "@/lib/utils";
import type { WithdrawalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const STATUS: Record<WithdrawalStatus, { label: string; variant: "main" | "lime" | "secondary" }> = {
  PENDING: { label: "Diproses", variant: "main" },
  APPROVED: { label: "Berhasil", variant: "lime" },
  REJECTED: { label: "Ditolak", variant: "secondary" },
};

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/withdraw");

  const { success, page: pageRaw } = await searchParams;
  const { min } = withdrawBounds();
  const locked = await referralLockedBalance(prisma, user.id);
  const withdrawable = Math.max(0, user.balance - locked);

  const totalWithdrawals = await prisma.withdrawal.count({ where: { userId: user.id } });
  const totalPages = Math.max(1, Math.ceil(totalWithdrawals / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const canWithdraw = withdrawable >= min;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/dashboard/topup" className="brutal-link text-sm">
        ← Top Up Saldo
      </Link>

      <div className="mt-5 space-y-5">
          <div className="border-3 border-ink bg-accent p-6 shadow-brutal">
            <div className="text-sm font-bold uppercase tracking-wide text-ink/70">
              Saldo Bisa Ditarik
            </div>
            <div className="mt-1 font-display text-4xl">{formatIDR(withdrawable)}</div>
            {locked > 0 && (
              <div className="mt-2 text-xs font-medium text-ink/70">
                Total saldo {formatIDR(user.balance)} · {formatIDR(locked)} bonus referral
                ditahan (bisa dipakai belanja, belum bisa ditarik).
              </div>
            )}
          </div>

          <div className="border-3 border-ink bg-white p-6 shadow-brutal">
            <h1 className="mb-4 font-display text-xl">Tarik Saldo</h1>
            {success && (
              <div className="mb-3">
                <Alert tone="success">
                  Penarikan diajukan! Saldo ditahan & menunggu persetujuan admin.
                </Alert>
              </div>
            )}
            {canWithdraw ? (
              <WithdrawForm balance={withdrawable} min={min} />
            ) : (
              <p className="text-sm font-medium text-ink/60">
                Saldo minimal untuk menarik adalah {formatIDR(min)}. Saldo kamu yang bisa
                ditarik belum cukup.
              </p>
            )}
          </div>

        <div id="riwayat" className="scroll-mt-24 border-3 border-ink bg-white p-6 shadow-brutal">
          <h2 className="mb-4 font-display text-xl">Riwayat Penarikan</h2>
          {totalWithdrawals === 0 ? (
            <p className="text-sm font-medium text-ink/50">Belum ada penarikan.</p>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => {
                const s = STATUS[w.status];
                return (
                  <div key={w.id} className="border-3 border-ink bg-paper px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display">{formatIDR(w.amount)}</span>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-ink/60">
                      {w.method === "BANK" ? "Bank" : "E-Wallet"} · {w.accountNumber} ·{" "}
                      {formatDate(w.createdAt)}
                    </div>
                    {w.adminNote && (
                      <div className="text-xs font-medium text-ink/70">
                        Catatan admin: {w.adminNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            baseHref="/dashboard/withdraw"
            hash="riwayat"
          />
        </div>
      </div>
    </div>
  );
}
