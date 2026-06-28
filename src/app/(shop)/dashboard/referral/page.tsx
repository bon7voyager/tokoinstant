import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateReferralCode, referralConfig } from "@/lib/referral";
import { Badge } from "@/components/ui";
import { formatIDR, formatDate } from "@/lib/utils";
import ReferralShare from "@/components/ReferralShare";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-3 border-ink bg-paper px-4 py-3 shadow-brutal-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink/55">{label}</div>
      <div className="mt-0.5 font-display text-2xl">{value}</div>
    </div>
  );
}

export default async function ReferralPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/referral");

  let code: string | null = null;
  try {
    code = await getOrCreateReferralCode(user.id);
  } catch {
    code = null; // codegen exhaustion -> show a graceful fallback, not a 500
  }
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const link = code ? `${baseUrl}/r/${code}` : null;
  const { referrerBonus, refereeBonus, minQualifyingTotal } = referralConfig();

  const [referrals, earnedAgg] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { referred: { select: { name: true } } },
    }),
    // Count net earnings AS A REFERRER (REFR:), not the user's own welcome bonus.
    // Net (no amount filter) so a refunded referral's clawback reduces the total.
    prisma.balanceTransaction.aggregate({
      where: { userId: user.id, ref: { startsWith: "REFR:" } },
      _sum: { amount: true },
    }),
  ]);

  const rewarded = referrals.filter((r) => r.status === "REWARDED").length;
  const earned = earnedAgg._sum.amount ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="brutal-link text-sm">
          ← Kembali ke dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl">🎁 Ajak Teman, Dapat Bonus</h1>
        <p className="font-medium text-ink/60">
          Bagikan link kamu. Saat teman <b>belanja pertama kali min. {formatIDR(minQualifyingTotal)}</b>,
          kamu dapat <b>{formatIDR(referrerBonus)}</b> dan teman dapat{" "}
          <b>{formatIDR(refereeBonus)}</b> — langsung masuk saldo.
        </p>
      </div>

      <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
        <h2 className="font-display text-xl">🔗 Link Referral Kamu</h2>
        {code && link ? (
          <>
            <p className="mt-1 text-sm font-medium text-ink/60">
              Kode: <code className="font-mono font-bold">{code}</code>
            </p>
            <div className="mt-3">
              <ReferralShare link={link} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-medium text-ink/50">
            Gagal membuat kode referral. Coba muat ulang halaman.
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Diajak" value={String(referrals.length)} />
        <Stat label="Sukses" value={String(rewarded)} />
        <Stat label="Bonus Didapat" value={formatIDR(earned)} />
      </div>

      <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
        <h2 className="font-display text-xl">👥 Teman yang Kamu Ajak</h2>
        {referrals.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-ink/50">
            Belum ada. Bagikan link kamu untuk mulai dapat bonus!
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto border-3 border-ink">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-3 py-2">Teman</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-ink/10 last:border-0">
                    <td className="px-3 py-2 font-bold">{r.referred.name}</td>
                    <td className="px-3 py-2">
                      {r.status === "REWARDED" ? (
                        <Badge variant="lime">✓ Bonus cair</Badge>
                      ) : (
                        <Badge variant="white">Menunggu belanja</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink/60">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
