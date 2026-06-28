import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isPremium, premiumConfig } from "@/lib/membership";
import { Alert, Badge, buttonStyles } from "@/components/ui";
import UpgradeForm from "@/components/UpgradeForm";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/upgrade");

  const { success } = await searchParams;
  const { fee, days, percent } = premiumConfig();
  const premium = isPremium(user);

  const benefits = [
    { emoji: "🏷️", title: `Diskon Reseller ${percent}%`, desc: "Otomatis di semua produk, setiap checkout." },
    { emoji: "⚡", title: "Harga modal", desc: "Cocok buat jualan lagi — ambil untung dari selisih." },
    { emoji: "🔁", title: "Berlaku semua produk", desc: "Streaming, musik, AI, dan lainnya." },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="brutal-link text-sm">
        ← Kembali ke dashboard
      </Link>

      <div className="mt-5 border-3 border-ink bg-grape p-6 text-white shadow-brutal-lg">
        <Badge variant="white">Membership</Badge>
        <h1 className="mt-3 font-display text-3xl">Member Reseller (Premium)</h1>
        <p className="mt-2 font-medium text-white/90">
          Bayar sekali di awal, langsung dapat <strong>harga reseller</strong> selama{" "}
          {days} hari.
        </p>
        {premium && user.premiumUntil && (
          <div className="mt-4 inline-block border-3 border-ink bg-lime px-3 py-1.5 font-bold text-ink">
            ✓ Aktif sampai {formatDate(user.premiumUntil)}
          </div>
        )}
      </div>

      {success && (
        <div className="mt-4">
          <Alert tone="success">
            🎉 Selamat! Membership reseller kamu aktif. Diskon {percent}% otomatis
            berlaku di setiap pembelian.
          </Alert>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {benefits.map((b) => (
          <div key={b.title} className="border-3 border-ink bg-white p-4 shadow-brutal">
            <div className="text-3xl">{b.emoji}</div>
            <h3 className="mt-2 font-bold">{b.title}</h3>
            <p className="mt-1 text-xs font-medium text-ink/60">{b.desc}</p>
          </div>
        ))}
      </div>

      {premium ? (
        <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal">
          <h2 className="mb-2 font-display text-xl">Membership Aktif 💎</h2>
          <p className="font-medium text-ink/70">
            Kamu sudah jadi reseller. Diskon {percent}% otomatis berlaku sampai{" "}
            <strong>{user.premiumUntil ? formatDate(user.premiumUntil) : "-"}</strong>.
          </p>
          <div className="mt-4 flex items-center gap-2 border-3 border-ink bg-paper px-4 py-3 text-sm font-bold">
            🔒 Upgrade lagi baru tersedia setelah masa berlaku habis.
          </div>
          <Link href="/produk" className={`${buttonStyles("ink", "md")} mt-4`}>
            Belanja dengan harga reseller →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal">
            <h2 className="mb-4 font-display text-xl">Upgrade Sekarang</h2>
            <UpgradeForm fee={fee} balance={user.balance} />
          </div>

          <p className="mt-4 text-center text-xs font-medium text-ink/50">
            Membership berlaku {days} hari sejak aktivasi. Diskon reseller {percent}%
            berlaku selama membership aktif.
          </p>
        </>
      )}
    </div>
  );
}
