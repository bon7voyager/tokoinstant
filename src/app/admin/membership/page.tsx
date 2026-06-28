import { prisma } from "@/lib/prisma";
import { premiumConfig } from "@/lib/membership";
import ResellerConfigForm from "@/components/ResellerConfigForm";
import BulkDiscountForm from "@/components/BulkDiscountForm";
import ResellerTable from "@/components/ResellerTable";
import PurchaseTable from "@/components/PurchaseTable";

export const dynamic = "force-dynamic";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
      <h2 className="font-display text-xl">{title}</h2>
      {desc && <p className="mt-1 text-sm font-medium text-ink/60">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminMembershipPage() {
  const now = new Date();
  const { fee, days, percent } = premiumConfig();

  const [products, resellers, purchases] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { category: { select: { name: true, emoji: true } } },
    }),
    prisma.user.findMany({
      where: { premiumUntil: { gt: now } },
      orderBy: { premiumUntil: "asc" },
      select: { id: true, name: true, email: true, premiumUntil: true },
    }),
    prisma.membershipPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const overridden = products.filter((p) => p.resellerPercent !== null).length;

  const productRows = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    resellerPercent: p.resellerPercent,
    category: p.category ? `${p.category.emoji} ${p.category.name}` : null,
  }));

  // Latest PAID membership purchase per active reseller -> their nominal & durasi.
  const memByUser = new Map<string, { amount: number; days: number }>();
  if (resellers.length > 0) {
    const mps = await prisma.membershipPurchase.findMany({
      where: { userId: { in: resellers.map((u) => u.id) }, status: "PAID" },
      orderBy: { createdAt: "desc" },
      select: { userId: true, amount: true, days: true },
    });
    for (const m of mps) {
      if (!memByUser.has(m.userId)) memByUser.set(m.userId, { amount: m.amount, days: m.days });
    }
  }

  const resellerRows = resellers.map((u) => {
    const m = memByUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      premiumUntil: u.premiumUntil ? u.premiumUntil.toISOString() : null,
      amount: m ? m.amount : null,
      days: m ? m.days : null,
    };
  });

  const purchaseRows = purchases.map((p) => ({
    id: p.id,
    name: p.user.name,
    email: p.user.email,
    amount: p.amount,
    days: p.days,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">💎 Membership Reseller</h1>
        <p className="font-medium text-ink/60">
          Satu tempat untuk program reseller: biaya & durasi, diskon per produk,
          daftar reseller aktif, dan riwayat pembelian.
        </p>
      </div>

      {/* 1. Program config */}
      <Section
        title="⚙️ Konfigurasi Program"
        desc="Biaya upgrade, durasi membership, dan diskon default untuk semua produk."
      >
        <ResellerConfigForm initial={{ fee, days, percent }} />
      </Section>

      {/* 2. Per-product discount (bulk) */}
      <Section
        title="🏷️ Diskon per Produk"
        desc={`Atur diskon reseller tiap produk. ${overridden} dari ${products.length} produk pakai diskon khusus.`}
      >
        {productRows.length === 0 ? (
          <p className="text-sm font-medium text-ink/50">Belum ada produk.</p>
        ) : (
          <BulkDiscountForm products={productRows} globalPercent={percent} />
        )}
      </Section>

      {/* 3. Active resellers */}
      <Section
        title={`👑 Reseller Aktif (${resellers.length})`}
        desc="Member dengan membership aktif. Cari, perpanjang, atau cabut di sini."
      >
        <ResellerTable resellers={resellerRows} days={days} />
      </Section>

      {/* 4. Membership purchase history */}
      <Section
        title="🧾 Riwayat Pembelian Membership"
        desc="Pembelian membership oleh user (100 terakhir)."
      >
        <PurchaseTable purchases={purchaseRows} />
      </Section>
    </div>
  );
}
