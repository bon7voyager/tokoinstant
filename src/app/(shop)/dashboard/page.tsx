import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buttonStyles } from "@/components/ui";
import ProfileForm from "@/components/ProfileForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { expireStaleOrders } from "@/lib/orders";
import { isPremium, premiumConfig } from "@/lib/membership";
import { referralConfig } from "@/lib/referral";
import { turnstileSiteKey } from "@/lib/turnstile";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  await expireStaleOrders();

  // Whether this account has a password (Google-only accounts don't) — drives the
  // "change password" vs "create password" form below.
  const acct = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  const hasPassword = !!acct?.password;

  const referralMin = referralConfig().minQualifyingTotal;

  // Summary stats across ALL orders (the full list lives on /dashboard/orders).
  const [totalOrders, completed, spentAgg] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.count({ where: { userId: user.id, status: "COMPLETED" } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { userId: user.id, status: "COMPLETED" },
    }),
  ]);
  const spent = spentAgg._sum.total ?? 0;

  const premium = isPremium(user);
  const { fee, days, percent } = premiumConfig();
  // Personalised hook: how much this buyer would have saved as a reseller.
  const potentialSavings = Math.round((spent * percent) / 100);

  const offerBenefits = [
    { emoji: "🏷️", text: `Diskon ${percent}% semua produk` },
    { emoji: "⚡", text: "Harga modal buat jualan lagi" },
    { emoji: "🔁", text: `Aktif penuh ${days} hari` },
  ];

  const stats = [
    { label: "Total Pesanan", value: totalOrders, bg: "bg-main" },
    { label: "Selesai", value: completed, bg: "bg-lime" },
    { label: "Total Belanja", value: formatIDR(spent), bg: "bg-accent" },
    { label: "Saldo", value: formatIDR(user.balance), bg: "bg-grape text-white" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div>
        <h1 className="font-display text-3xl">Halo, {user.name} 👋</h1>
        <p className="font-medium text-ink/60">Selamat datang di dashboard kamu.</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link href="/dashboard/orders" className={`${buttonStyles("white", "md")} w-full`}>
          🧾 Pesanan Saya
        </Link>
        <Link href="/produk" className={`${buttonStyles("ink", "md")} w-full`}>
          + Belanja Lagi
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`border-3 border-ink ${s.bg} p-5 shadow-brutal`}>
            <div className="text-sm font-bold uppercase tracking-wide opacity-70">
              {s.label}
            </div>
            <div className="mt-1 font-display text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Membership — active status (compact) vs offer (rich, for non-members) */}
      {premium ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-3 border-ink bg-grape p-5 text-white shadow-brutal">
          <div>
            <div className="font-display text-xl">💎 Member Reseller Aktif</div>
            <p className="text-sm font-medium text-white/90">
              Diskon {percent}% otomatis · berlaku s/d{" "}
              {user.premiumUntil ? formatDate(user.premiumUntil) : "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/api" className={buttonStyles("ink", "md")}>
              ⚡ API Reseller
            </Link>
            <Link href="/dashboard/upgrade" className={buttonStyles("white", "md")}>
              Lihat Status
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden border-3 border-ink bg-grape text-white shadow-brutal-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="max-w-xl">
              <span className="inline-block border-2 border-ink bg-lime px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-ink">
                Hemat {percent}% · mulai {formatIDR(fee)}
              </span>
              <h2 className="mt-2 font-display text-2xl leading-tight">
                Jadi Member Reseller 💎
              </h2>
              <p className="mt-1 text-sm font-medium text-white/90">
                Bayar <b>{formatIDR(fee)}</b> sekali, langsung dapat diskon{" "}
                <b>{percent}%</b> di semua produk selama {days} hari. Cocok buat
                dipakai sendiri atau dijual lagi.
              </p>
              {potentialSavings > 0 && (
                <p className="mt-3 inline-block border-2 border-ink bg-lime px-3 py-1 text-sm font-bold text-ink">
                  💰 Dari belanjamu {formatIDR(spent)}, kamu bisa hemat ~
                  {formatIDR(potentialSavings)} sebagai reseller
                </p>
              )}
            </div>
            <Link
              href="/dashboard/upgrade"
              className={`${buttonStyles("white", "lg")} shrink-0`}
            >
              Upgrade Sekarang →
            </Link>
          </div>

          {/* Benefits strip */}
          <div className="grid gap-px border-t-3 border-ink bg-ink sm:grid-cols-3">
            {offerBenefits.map((b) => (
              <div
                key={b.text}
                className="flex items-center gap-2 bg-grape px-4 py-3 text-sm font-bold"
              >
                <span className="text-lg">{b.emoji}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral CTA */}
      <Link
        href="/dashboard/referral"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 border-3 border-ink bg-bubble p-5 shadow-brutal transition-transform hover:-translate-y-0.5"
      >
        <div>
          <div className="font-display text-xl">🎁 Ajak Teman, Dapat Bonus Saldo</div>
          <p className="text-sm font-medium text-ink/70">
            Bagikan link referralmu — kamu &amp; teman sama-sama dapat saldo saat teman
            belanja pertama kali min. {formatIDR(referralMin)}.
          </p>
        </div>
        <span className={buttonStyles("ink", "md")}>Lihat Link →</span>
      </Link>

      {/* Wallet — full-width single row */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-3 border-ink bg-lime p-5 shadow-brutal">
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-ink/70">Dompet</div>
          <div className="mt-1 font-display text-3xl">{formatIDR(user.balance)}</div>
          <p className="mt-1 text-sm font-medium text-ink/70">
            Top up saldo untuk checkout sekali klik.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/topup" className={buttonStyles("ink", "md")}>
            + Top Up Saldo
          </Link>
          <Link href="/dashboard/withdraw" className={buttonStyles("white", "md")}>
            Tarik Saldo
          </Link>
        </div>
      </div>

      {/* Profile — its own card */}
      <div id="profil" className="mt-6 scroll-mt-24 border-3 border-ink bg-white p-5 shadow-brutal">
        <h2 className="mb-3 font-display text-lg">Profil Saya</h2>
        <ProfileForm name={user.name} email={user.email} phone={user.phone} />
      </div>

      {/* Change password — its own card */}
      <div id="keamanan" className="mt-6 scroll-mt-24 border-3 border-ink bg-white p-5 shadow-brutal">
        <h2 className="mb-3 font-display text-lg">
          {hasPassword ? "Ganti Password" : "Buat Password"}
        </h2>
        <ChangePasswordForm hasPassword={hasPassword} turnstileSiteKey={turnstileSiteKey()} />
      </div>
    </div>
  );
}
