import "server-only";
import { prisma } from "@/lib/prisma";
import { debitBalanceTx } from "@/lib/wallet";

/**
 * Shared atomic settlement: increments coupon usage, debits balance (if paying
 * with balance), reserves stock, and marks the order COMPLETED — all in one
 * transaction. Throws on failure. Reused by payOrderAction (simulation/balance)
 * and by the gateway webhook. Idempotent: a non-PENDING order throws ALREADY_PROCESSED.
 *
 * NOT a server action (lives in a server-only module) so it can only be invoked
 * by trusted server code (the pay wrapper and the gateway webhook) — never
 * reachable directly from a client via a crafted Next-Action POST, which would
 * otherwise bypass the auth/ownership/payment guards in payOrderAction.
 */
export async function settleOrderTransaction(
  orderId: string,
  opts: { useBalance: boolean; paymentRef: string; payMethod?: "BALANCE" | "GATEWAY" },
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

    const product = await tx.product.findUnique({
      where: { id: order.productId },
      select: { fulfillment: true },
    });
    const manual = product?.fulfillment === "MANUAL";

    // (A) Coupon: atomic usedCount increment with quota/active/expiry guard.
    if (order.couponId) {
      const c = await tx.coupon.findUnique({
        where: { id: order.couponId },
        select: { quota: true, isActive: true, expiresAt: true },
      });
      if (!c || !c.isActive || (c.expiresAt && c.expiresAt < now)) {
        throw new Error("COUPON_INVALID");
      }
      const where =
        c.quota == null
          ? { id: order.couponId, isActive: true }
          : { id: order.couponId, isActive: true, usedCount: { lt: c.quota } };
      const upd = await tx.coupon.updateMany({
        where,
        data: { usedCount: { increment: 1 } },
      });
      if (upd.count === 0) throw new Error("COUPON_EXHAUSTED");
    }

    // (B) Balance: race-safe debit for the (discounted) total.
    if (opts.useBalance && order.total > 0) {
      const bal = await debitBalanceTx(
        tx,
        order.userId,
        order.total,
        "PURCHASE",
        null,
        order.orderNumber,
      );
      if (bal === null) throw new Error("INSUFFICIENT_BALANCE");
    }

    if (manual) {
      // (C') Manual delivery: payment received, no stock reserved.
      // Order waits at PAID until an admin sends the product.
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: now,
          paymentRef: opts.paymentRef,
          ...(opts.payMethod ? { payMethod: opts.payMethod } : {}),
        },
      });
      return;
    }

    // (C) Stock: reserve oldest AVAILABLE units from the order's variant pool
    // (variantId null = product-level pool for non-variant products).
    const stocks = await tx.stock.findMany({
      where: { productId: order.productId, variantId: order.variantId ?? null, status: "AVAILABLE" },
      orderBy: { createdAt: "asc" },
      take: order.quantity,
    });
    if (stocks.length < order.quantity) throw new Error("OUT_OF_STOCK");

    const ids = stocks.map((s) => s.id);
    const reserved = await tx.stock.updateMany({
      where: { id: { in: ids }, status: "AVAILABLE" },
      data: { status: "SOLD", orderId: order.id },
    });
    if (reserved.count < order.quantity) throw new Error("OUT_OF_STOCK");

    // (D) Complete (record the method actually used, if provided).
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        paidAt: now,
        completedAt: now,
        paymentRef: opts.paymentRef,
        ...(opts.payMethod ? { payMethod: opts.payMethod } : {}),
      },
    });
  });
}
