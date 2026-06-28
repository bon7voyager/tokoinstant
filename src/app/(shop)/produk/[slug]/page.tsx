import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import BuyForm from "@/components/BuyForm";
import LiveSaleFeed from "@/components/LiveSaleFeed";
import { productVisual } from "@/components/ProductCard";
import { isPremium } from "@/lib/membership";
import { getFlashInfo, effectivePrice } from "@/lib/flash-sale";
import FlashCountdown from "@/components/FlashCountdown";
import { turnstileSiteKey } from "@/lib/turnstile";
import { getProductRating } from "@/lib/ratings";
import { contactInfo } from "@/lib/contact";
import { formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product || !product.isActive) notFound();

  // Count this view, but skip Next.js prefetch hits (a <Link> prefetched on
  // hover/viewport) so the counter reflects real visits and we don't write on
  // prefetch. Fire-and-forget — the increment never blocks or breaks the render.
  const hdrs = await headers();
  const isPrefetch =
    hdrs.get("next-router-prefetch") === "1" ||
    (hdrs.get("purpose") ?? hdrs.get("sec-purpose") ?? "").includes("prefetch");
  if (!isPrefetch) {
    prisma.product
      .update({ where: { id: product.id }, data: { views: { increment: 1 } } })
      .catch(() => {});
  }

  const [stockGroups, user, rating, flash] = await Promise.all([
    prisma.stock.groupBy({
      by: ["variantId"],
      where: { productId: product.id, status: "AVAILABLE" },
      _count: { _all: true },
    }),
    getCurrentUser(),
    getProductRating(product.id),
    getFlashInfo(product.id),
  ]);
  const stockBy = (variantId: string | null) =>
    stockGroups.find((g) => g.variantId === variantId)?._count._all ?? 0;

  const visual = productVisual(product.name);
  const isManual = product.fulfillment === "MANUAL";
  const premium = isPremium(user);
  const contact = contactInfo();

  // Variant pricing/stock (each variant has its own pool); empty if no variants.
  // Reseller discount is the product's own % when set, else the global default.
  const hasVariants = product.variants.length > 0;
  const variantData = product.variants.map((v) => {
    const eff = effectivePrice(v.price, premium, product.resellerPercent, flash);
    return {
      id: v.id,
      name: v.name,
      price: eff.price,
      listPrice: eff.price < v.price ? v.price : null, // strike-through only when actually discounted
      stockAvailable: stockBy(v.id),
    };
  });
  const stockAvailable = stockBy(null);
  const displayEff = effectivePrice(product.price, premium, product.resellerPercent, flash);
  const displayPrice = displayEff.price;

  // Customizable highlight badges (controlled per-product from the admin).
  const highlights: { bg: string; text: string }[] = [];
  if (product.instant) {
    highlights.push({
      bg: "bg-main",
      text: isManual ? "⚡ Proses Cepat" : "⚡ Instan",
    });
  }
  highlights.push({
    bg: "bg-accent",
    text: `🛡️ ${product.warranty?.trim() || "Garansi"}`,
  });
  if (product.isOfficial) {
    highlights.push({ bg: "bg-lime", text: "✅ Resmi" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/produk" className="brutal-link text-sm">
        ← Kembali ke katalog
      </Link>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {/* Visual */}
        <div>
          <div
            className={`flex h-72 items-center justify-center overflow-hidden border-3 border-ink ${product.imageUrl ? "bg-white" : visual.bg} shadow-brutal`}
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[7rem] drop-shadow-[4px_4px_0_rgba(0,0,0,0.25)]">
                {visual.emoji}
              </span>
            )}
          </div>
          {highlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 text-center text-sm font-bold">
              {highlights.map((h) => (
                <div
                  key={h.text}
                  className={`min-w-[6rem] flex-1 border-3 border-ink ${h.bg} px-2 py-3 shadow-brutal-sm`}
                >
                  {h.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info + buy */}
        <div>
          {product.category && (
            <Badge variant="white">
              {product.category.emoji} {product.category.name}
            </Badge>
          )}
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {product.name}
          </h1>
          {displayEff.isFlash && displayEff.flashEndsAt && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-3 border-ink bg-secondary px-3 py-2 text-sm font-bold text-white shadow-brutal-sm">
              ⚡ FLASH SALE · berakhir dalam{" "}
              <FlashCountdown endsAt={displayEff.flashEndsAt.toISOString()} />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
            {rating.count > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-base leading-none">⭐</span>
                <span>{rating.avg.toFixed(1)}</span>
                <span className="font-medium text-ink/50">/ 5 · {rating.count} ulasan</span>
              </span>
            ) : (
              <span className="font-medium text-ink/50">Belum ada ulasan</span>
            )}
            {product.views > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-ink/50">
                👁️ {formatCount(product.views)} dilihat
              </span>
            )}
          </div>
          {product.badge && (
            <span className="mt-2 inline-block">
              <Badge variant="secondary">{product.badge}</Badge>
            </span>
          )}

          <p className="mt-4 font-medium leading-relaxed text-ink/80">
            {product.description}
          </p>

          <div className="mt-6 border-3 border-ink bg-white p-5 shadow-brutal">
            <BuyForm
              productId={product.id}
              price={displayPrice}
              listPrice={displayPrice < product.price ? product.price : null}
              stockAvailable={stockAvailable}
              variants={hasVariants ? variantData : undefined}
              isLoggedIn={!!user}
              manual={isManual}
              turnstileSiteKey={turnstileSiteKey()}
            />
          </div>

          <div className="mt-5 space-y-2 text-sm font-medium text-ink/70">
            {isManual ? (
              <p>🧑‍💼 Diproses <strong>manual oleh admin</strong> setelah pembayaran (biasanya maks 1×24 jam).</p>
            ) : (
              <p>📦 Akun dikirim <strong>otomatis</strong> ke dashboard setelah pembayaran.</p>
            )}
            <p>🔒 Transaksi aman, data kamu terlindungi.</p>
            <p>
              💬 Butuh bantuan?{" "}
              {contact.waLink ? (
                <a href={contact.waLink} target="_blank" rel="noopener noreferrer" className="brutal-link">
                  Chat admin di WhatsApp
                </a>
              ) : (
                <a href={`mailto:${contact.email}`} className="brutal-link">
                  Hubungi admin
                </a>
              )}
              .
            </p>
          </div>
        </div>
      </div>

      <LiveSaleFeed />
    </div>
  );
}
