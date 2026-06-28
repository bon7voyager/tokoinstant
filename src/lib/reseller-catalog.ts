import "server-only";
import { prisma } from "@/lib/prisma";
import { resellerPrice } from "@/lib/membership";

type ProductLike = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  resellerPercent: number | null;
  fulfillment: "AUTO" | "MANUAL";
  category: { name: string } | null;
  variants: { id: string; name: string; price: number }[];
};

const stockKey = (pid: string, vid: string | null) => `${pid}:${vid ?? ""}`;

function serializeProduct(p: ProductLike, stockMap: Map<string, number>) {
  const stockOf = (vid: string | null) =>
    p.fulfillment === "MANUAL" ? null : stockMap.get(stockKey(p.id, vid)) ?? 0;
  const hasVariants = p.variants.length > 0;
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category?.name ?? null,
    fulfillment: p.fulfillment, // AUTO = instant from stock, MANUAL = admin-delivered
    price: hasVariants ? null : resellerPrice(p.price, true, p.resellerPercent),
    list_price: hasVariants ? null : p.price,
    stock: hasVariants ? null : stockOf(null),
    variants: hasVariants
      ? p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: resellerPrice(v.price, true, p.resellerPercent),
          list_price: v.price,
          stock: stockOf(v.id),
        }))
      : null,
  };
}

/** Active catalog with reseller prices + live stock. */
export async function listResellerProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  const groups = await prisma.stock.groupBy({
    by: ["productId", "variantId"],
    where: {
      status: "AVAILABLE",
      OR: [{ variantId: null }, { variant: { isActive: true } }],
    },
    _count: { _all: true },
  });
  const stockMap = new Map<string, number>();
  for (const g of groups) stockMap.set(stockKey(g.productId, g.variantId), g._count._all);

  return products.map((p) => serializeProduct(p, stockMap));
}

/** One product by slug, or null if missing/inactive. */
export async function getResellerProduct(slug: string) {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p || !p.isActive) return null;

  const groups = await prisma.stock.groupBy({
    by: ["variantId"],
    where: { productId: p.id, status: "AVAILABLE" },
    _count: { _all: true },
  });
  const stockMap = new Map<string, number>();
  for (const g of groups) stockMap.set(stockKey(p.id, g.variantId), g._count._all);

  return serializeProduct(p, stockMap);
}
