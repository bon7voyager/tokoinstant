import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import AdjustForm from "@/components/AdjustForm";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminBalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;

  // Global figures stay across ALL users, not just the current page.
  const [balanceAgg, total] = await Promise.all([
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.user.count(),
  ]);
  const totalBalance = balanceAgg._sum.balance ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const users = await prisma.user.findMany({
    orderBy: { balance: "desc" },
    include: {
      balanceTransactions: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Saldo Pengguna</h1>
      <p className="font-medium text-ink/60">
        Lihat & sesuaikan saldo. Total saldo beredar: <b>{formatIDR(totalBalance)}</b>
      </p>

      <div className="mt-6 space-y-4">
        {users.map((u) => (
          <div key={u.id} className="border-3 border-ink bg-white p-5 shadow-brutal">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold">
                  {u.name}{" "}
                  {u.role === "ADMIN" && <Badge variant="grape">Admin</Badge>}
                </div>
                <div className="text-xs text-ink/50">{u.email}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase text-ink/50">Saldo</div>
                <div className="font-display text-2xl">{formatIDR(u.balance)}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-ink/50">
                  Sesuaikan Saldo
                </div>
                <AdjustForm userId={u.id} />
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-ink/50">
                  Transaksi Terakhir
                </div>
                {u.balanceTransactions.length === 0 ? (
                  <p className="text-xs text-ink/40">Belum ada.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {u.balanceTransactions.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="text-ink/60">
                          {t.type} · {formatDate(t.createdAt)}
                        </span>
                        <span className={t.amount >= 0 ? "font-bold" : "font-bold text-secondary"}>
                          {t.amount >= 0 ? "+" : "−"} {formatIDR(Math.abs(t.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref="/admin/balances" />
    </div>
  );
}
