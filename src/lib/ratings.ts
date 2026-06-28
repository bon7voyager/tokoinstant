import "server-only";
import { prisma } from "@/lib/prisma";

export const RATING_AUTO_DAYS = 2;

/**
 * Auto-fill a 5★ rating for COMPLETED orders the buyer never rated within
 * RATING_AUTO_DAYS of receiving them. Lazy (called on high-traffic page loads,
 * like expireStaleOrders) — no cron needed. Idempotent via the unique orderId.
 */
export async function autoRateStaleOrders(): Promise<void> {
  try {
    // Window starts at completedAt (delivery/receipt), not paidAt — MANUAL orders
    // are delivered after payment, so paidAt would start the clock too early.
    const threshold = new Date(Date.now() - RATING_AUTO_DAYS * 86_400_000);
    const stale = await prisma.order.findMany({
      where: { status: "COMPLETED", completedAt: { lt: threshold }, rating: { is: null } },
      select: { id: true, userId: true, productId: true },
      take: 500,
    });
    if (stale.length === 0) return;
    const data = stale.map((o) => ({
      orderId: o.id,
      userId: o.userId,
      productId: o.productId,
      stars: 5,
      isAuto: true,
    }));
    try {
      await prisma.rating.createMany({ data });
    } catch {
      // SQLite aborts the whole batch on a single unique-orderId collision (a
      // concurrent rating). Fall back to per-row so the rest still land.
      for (const d of data) {
        await prisma.rating.create({ data: d }).catch(() => {});
      }
    }
  } catch {
    /* never throw — safe to call lazily on hot page loads */
  }
}

/**
 * Real-time homepage stats — pure live DB counts (no marketing base offset).
 * "Satisfied customers" = distinct buyers who left a >=4★ rating on an order that
 * is still COMPLETED (a later refund drops them from the count).
 */
export async function getHomeStats(): Promise<{
  ordersCompleted: number;
  satisfiedCustomers: number;
  products: number;
}> {
  await autoRateStaleOrders().catch(() => {});
  const [ordersCompleted, satisfiedGroups, products] = await Promise.all([
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.rating.groupBy({
      by: ["userId"],
      where: { stars: { gte: 4 }, order: { status: "COMPLETED" } },
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);
  return {
    ordersCompleted,
    satisfiedCustomers: satisfiedGroups.length,
    products,
  };
}

export type Testimonial = {
  name: string;
  stars: number;
  comment: string;
  product: string;
  createdAt: string;
};

/** Most recent real reviews (>=4★, has a written comment, order still COMPLETED).
 * Exposes only the buyer's display name (login is by email, so it's not a credential). */
export async function getRecentTestimonials(limit = 12): Promise<Testimonial[]> {
  const rows = await prisma.rating.findMany({
    where: { stars: { gte: 4 }, comment: { not: null }, order: { status: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      stars: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
      product: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    name: r.user.name,
    stars: r.stars,
    comment: r.comment!,
    product: r.product.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Average rating + count for one product. */
export async function getProductRating(
  productId: string,
): Promise<{ avg: number; count: number }> {
  const agg = await prisma.rating.aggregate({
    where: { productId, order: { status: "COMPLETED" } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  return { avg: agg._avg.stars ?? 0, count: agg._count._all };
}

export type ProductRating = { avg: number; count: number };

/** Average rating + count for many products in one query (catalog cards).
 * Returns a Map keyed by productId; products with no eligible ratings are absent. */
export async function getProductRatings(
  productIds: string[],
): Promise<Map<string, ProductRating>> {
  if (productIds.length === 0) return new Map();
  const groups = await prisma.rating.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds }, order: { status: "COMPLETED" } },
    _avg: { stars: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [
      g.productId,
      { avg: g._avg.stars ?? 0, count: g._count._all },
    ]),
  );
}
