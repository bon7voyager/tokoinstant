import { prisma } from "@/lib/prisma";
import { cfg } from "@/lib/settings-store";

/** Minutes a PENDING order stays payable before auto-cancellation. */
export function orderExpiryMinutes() {
  const n = Number(cfg("ORDER_EXPIRY_MINUTES"));
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export function orderExpiryDate(from: Date = new Date()) {
  return new Date(from.getTime() + orderExpiryMinutes() * 60_000);
}

/**
 * Cancel PENDING orders whose payment deadline has passed (status -> EXPIRED).
 * Idempotent and cheap; safe to call opportunistically on order-listing reads
 * or from a scheduled cron. (`{ lt }` on a nullable column excludes nulls.)
 */
export async function expireStaleOrders(): Promise<number> {
  const res = await prisma.order.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return res.count;
}
