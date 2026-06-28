"use server";

import { prisma } from "@/lib/prisma";

export type RecentSale = {
  name: string;
  product: string;
  paidAt: string;
  kind: "order" | "membership";
};

// "Budi Pelanggan" -> "Budi P." ; single word -> partially masked ("Budiman" -> "Bu…")
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Seseorang";
  if (parts.length === 1) {
    return parts[0].length > 2 ? `${parts[0].slice(0, 2)}…` : parts[0];
  }
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/** How recent a sale must be to appear in the live feed (1 day). */
const LIVE_SALE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Max number of sales shown in the live feed. */
const LIVE_SALE_LIMIT = 10;

/** Recent purchases (products + memberships) for the live-sale feed. Public read.
 * Only sales paid within the last 1 day are shown — nothing older — capped at 10. */
export async function getRecentSalesAction(): Promise<RecentSale[]> {
  const since = new Date(Date.now() - LIVE_SALE_WINDOW_MS);
  const [orders, memberships] = await Promise.all([
    prisma.order.findMany({
      where: { status: "COMPLETED", paidAt: { gte: since } },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: LIVE_SALE_LIMIT,
    }),
    prisma.membershipPurchase.findMany({
      where: { status: "PAID", paidAt: { gte: since } },
      include: { user: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: LIVE_SALE_LIMIT,
    }),
  ]);

  const orderSales: RecentSale[] = orders.map((o) => ({
    name: maskName(o.user.name),
    product: o.product.name,
    paidAt: (o.paidAt ?? o.createdAt).toISOString(),
    kind: "order",
  }));

  const memberSales: RecentSale[] = memberships.map((m) => ({
    name: maskName(m.user.name),
    product: "Member Reseller",
    paidAt: (m.paidAt ?? m.createdAt).toISOString(),
    kind: "membership",
  }));

  // Merge both streams, newest first, cap at the live-sale limit.
  return [...orderSales, ...memberSales]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, LIVE_SALE_LIMIT);
}
