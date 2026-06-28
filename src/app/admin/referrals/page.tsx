import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate, cn, normalizeEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const FILTERS = ["ALL", "PENDING", "REWARDED"] as const;
const STATUS: Record<string, { label: string; variant: "main" | "lime" }> = {
  PENDING: { label: "Menunggu belanja", variant: "main" },
  REWARDED: { label: "Bonus cair", variant: "lime" },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-3 border-ink bg-white px-4 py-3 shadow-brutal-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink/55">{label}</div>
      <div className="mt-0.5 font-display text-2xl">{value}</div>
      {sub && <div className="text-[11px] font-medium text-ink/50">{sub}</div>}
    </div>
  );
}

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageRaw } = await searchParams;
  const filter = status && status !== "ALL" ? status : undefined;
  const where = filter ? { status: filter } : {};

  const [filteredTotal, total, rewardedCount, pendingCount, bonusAgg] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.count(),
    prisma.referral.count({ where: { status: "REWARDED" } }),
    prisma.referral.count({ where: { status: "PENDING" } }),
    prisma.balanceTransaction.aggregate({
      where: { OR: [{ ref: { startsWith: "REFR:" } }, { ref: { startsWith: "REFE:" } }] },
      _sum: { amount: true },
    }),
  ]);
  const conversion = total > 0 ? Math.round((rewardedCount / total) * 100) : 0;

  // ---- Top pengajak (leaderboard): diajak, sukses, bonus per referrer ----
  const [byAll, byRewarded, byBonus] = await Promise.all([
    prisma.referral.groupBy({ by: ["referrerId"], _count: { _all: true } }),
    prisma.referral.groupBy({ by: ["referrerId"], where: { status: "REWARDED" }, _count: { _all: true } }),
    prisma.balanceTransaction.groupBy({ by: ["userId"], where: { ref: { startsWith: "REFR:" } }, _sum: { amount: true } }),
  ]);
  const rewardedByRef = new Map(byRewarded.map((r) => [r.referrerId, r._count._all]));
  const bonusByRef = new Map(byBonus.map((r) => [r.userId, r._sum.amount ?? 0]));
  const leaderboard = byAll
    .map((r) => ({
      referrerId: r.referrerId,
      diajak: r._count._all,
      sukses: rewardedByRef.get(r.referrerId) ?? 0,
      bonus: bonusByRef.get(r.referrerId) ?? 0,
    }))
    .sort((a, b) => b.sukses - a.sukses || b.diajak - a.diajak || b.bonus - a.bonus)
    .slice(0, 10);
  const lbUsers = await prisma.user.findMany({
    where: { id: { in: leaderboard.map((l) => l.referrerId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(lbUsers.map((u) => [u.id, u]));
  const medal = ["🥇", "🥈", "🥉"];

  // ---- Detail list (filterable + paginated) ----
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const referrals = await prisma.referral.findMany({
    where,
    include: {
      referrer: { select: { name: true, email: true, signupIp: true } },
      referred: { select: { name: true, email: true, signupIp: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const refs = referrals.flatMap((r) => [`REFR:${r.id}`, `REFE:${r.id}`]);
  const sums = refs.length
    ? await prisma.balanceTransaction.groupBy({ by: ["ref"], where: { ref: { in: refs } }, _sum: { amount: true } })
    : [];
  const byRef = new Map(sums.map((s) => [s.ref, s._sum.amount ?? 0]));

  const baseHref = `/admin/referrals${status ? `?status=${status}` : ""}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Tracking Referral</h1>
      <p className="font-medium text-ink/60">
        Pantau program referral: performa, siapa mengajak siapa, dan tanda akun yang dicurigai
        mengakali. Aturan &amp; bonus diatur di{" "}
        <Link href="/admin/settings" className="brutal-link">
          Pengaturan
        </Link>
        .
      </p>

      {/* Metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Ajakan" value={String(total)} />
        <Stat label="Berhasil" value={String(rewardedCount)} sub={`konversi ${conversion}%`} />
        <Stat label="Menunggu" value={String(pendingCount)} />
        <Stat label="Total Bonus Dibayar" value={formatIDR(bonusAgg._sum.amount ?? 0)} />
      </div>

      {/* Leaderboard */}
      <h2 className="mt-8 font-display text-xl">🏆 Top Pengajak</h2>
      <div className="mt-3 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Pengajak</th>
              <th className="px-4 py-3 text-right">Diajak</th>
              <th className="px-4 py-3 text-right">Sukses</th>
              <th className="px-4 py-3 text-right">Bonus Didapat</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada pengajak.
                </td>
              </tr>
            ) : (
              leaderboard.map((l, i) => {
                const u = userById.get(l.referrerId);
                return (
                  <tr key={l.referrerId} className="border-b border-ink/10 last:border-0">
                    <td className="px-4 py-3 font-display text-base">{medal[i] ?? i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u?.name ?? "—"}</div>
                      <div className="text-xs text-ink/50">{u?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{l.diajak}</td>
                    <td className="px-4 py-3 text-right font-bold">{l.sukses}</td>
                    <td className="px-4 py-3 text-right font-display">{formatIDR(l.bonus)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail list */}
      <h2 className="mt-8 font-display text-xl">Semua Referral</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/referrals?status=${f}`}
            className={cn(
              "border-3 border-ink px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm",
              (status ?? "ALL") === f ? "bg-main" : "bg-white",
            )}
          >
            {f === "ALL" ? "Semua" : STATUS[f].label}
          </Link>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Pengajak</th>
              <th className="px-4 py-3">Teman Diajak</th>
              <th className="px-4 py-3">Bonus</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {referrals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada referral.
                </td>
              </tr>
            ) : (
              referrals.map((r) => {
                const s = STATUS[r.status] ?? STATUS.PENDING;
                const referrerBonus = byRef.get(`REFR:${r.id}`) ?? 0;
                const refereeBonus = byRef.get(`REFE:${r.id}`) ?? 0;
                const sameEmail =
                  normalizeEmail(r.referrer.email) === normalizeEmail(r.referred.email);
                const sameIp = !!r.referrer.signupIp && r.referrer.signupIp === r.referred.signupIp;
                return (
                  <tr key={r.id} className="border-b border-ink/10 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.referrer.name}</div>
                      <div className="text-xs text-ink/50">{r.referrer.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.referred.name}</div>
                      <div className="text-xs text-ink/50">{r.referred.email}</div>
                      {(sameEmail || sameIp) && (
                        <div className="mt-1 inline-block border-2 border-ink bg-secondary px-1.5 text-[10px] font-bold uppercase text-white">
                          ⚠ {sameEmail ? "Email sama" : "IP sama"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.status === "REWARDED" ? (
                        <>
                          <div>Pengajak {formatIDR(referrerBonus)}</div>
                          <div>Teman {formatIDR(refereeBonus)}</div>
                        </>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink/60">
                      <div>{formatDate(r.createdAt)}</div>
                      {r.rewardedAt && (
                        <div className="text-ink/40">cair: {formatDate(r.rewardedAt)}</div>
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
