import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPremium } from "@/lib/membership";
import { getFlashInfos, effectivePrice } from "@/lib/flash-sale";
import { buttonStyles, Input, Button } from "@/components/ui";
import ProductCard from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { getProductRatings } from "@/lib/ratings";

export const dynamic = "force-dynamic";

async function getCatalog(categorySlug?: string, q?: string) {
  const term = q?.trim();
  const [categories, products, stockGroups] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(term ? { name: { contains: term } } : {}),
      },
      include: {
        category: true,
        variants: { where: { isActive: true }, select: { price: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stock.groupBy({
      by: ["productId"],
      where: {
        status: "AVAILABLE",
        OR: [{ variantId: null }, { variant: { isActive: true } }],
      },
      _count: { _all: true },
    }),
  ]);

  const stockMap = new Map(stockGroups.map((g) => [g.productId, g._count._all]));
  const ratingMap = await getProductRatings(products.map((p) => p.id));
  const flashMap = await getFlashInfos(products.map((p) => p.id));

  return {
    categories,
    products: products.map((p) => ({
      ...p,
      stockAvailable: stockMap.get(p.id) ?? 0,
      rating: ratingMap.get(p.id) ?? { avg: 0, count: 0 },
      flash: flashMap.get(p.id) ?? null,
    })),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; q?: string }>;
}) {
  const { kategori, q } = await searchParams;
  const qParam = q?.trim() ? `q=${encodeURIComponent(q.trim())}` : "";
  const { categories, products: rawProducts } = await getCatalog(kategori, q);
  const user = await getCurrentUser();
  const premium = isPremium(user);

  // Effective price = lowest of reseller vs flash-sale. Variant products show "mulai dari".
  const products = rawProducts.map((p) => {
    const variantPrices = p.variants.map((v) => v.price);
    const hasVariants = variantPrices.length > 0;
    const baseList = hasVariants ? Math.min(...variantPrices) : p.price;
    const eff = effectivePrice(baseList, premium, p.resellerPercent, p.flash);
    return {
      ...p,
      price: eff.price,
      originalPrice: eff.price < baseList ? baseList : null,
      priceFrom: hasVariants,
      isFlash: eff.isFlash,
    };
  });

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <Link href="/" className="brutal-link text-sm">
        ← Kembali ke beranda
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Katalog Produk</h1>
        <span className="border-3 border-ink bg-white px-3 py-1.5 text-sm font-bold text-ink shadow-brutal-sm">
          {products.length} produk
        </span>
      </div>

      {/* Search */}
      <form action="/produk" method="get" className="mt-6 mb-4 flex max-w-md gap-2">
        {kategori && <input type="hidden" name="kategori" value={kategori} />}
        <Input name="q" defaultValue={q ?? ""} placeholder="Cari produk…" className="flex-1" />
        <Button type="submit" variant="ink" size="sm">
          Cari
        </Button>
      </form>
      {q?.trim() && (
        <p className="mb-4 text-sm font-medium text-ink/60">
          {products.length} hasil untuk “{q.trim()}”.{" "}
          <Link href={kategori ? `/produk?kategori=${kategori}` : "/produk"} className="brutal-link">
            Reset
          </Link>
        </p>
      )}

      {/* Category filter */}
      <div className="mb-7 flex flex-wrap gap-2">
        <Link
          href={qParam ? `/produk?${qParam}` : "/produk"}
          className={!kategori ? buttonStyles("ink", "sm") : buttonStyles("white", "sm")}
        >
          Semua
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/produk?kategori=${c.slug}${qParam ? `&${qParam}` : ""}`}
            className={kategori === c.slug ? buttonStyles("ink", "sm") : buttonStyles("white", "sm")}
          >
            {c.emoji} {c.name}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          title={q?.trim() ? `Tidak ada produk untuk “${q.trim()}”` : "Belum ada produk di kategori ini"}
          desc="Coba kata kunci atau kategori lain."
          cta={{ href: "/produk", label: "Lihat Semua" }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
