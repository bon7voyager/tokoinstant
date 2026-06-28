import "server-only";
import { prisma } from "@/lib/prisma";
import { creditBalanceTx } from "@/lib/wallet";

/**
 * Settle a top-up: mark PAID + credit balance atomically. Idempotent.
 * Returns the credit info for notification, or null if already processed.
 *
 * NOT a server action (lives in a server-only module) so it can only be invoked
 * by trusted server code (the confirm wrapper and the gateway webhook) — never
 * reachable directly from a client via a crafted Next-Action POST, which would
 * otherwise be a free balance credit bypassing payTopUpAction's guards.
 */
export async function settleTopUpTransaction(
  topUpId: string,
  paymentRef: string,
): Promise<{ userId: string; amount: number; newBalance: number } | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const upd = await tx.topUp.updateMany({
      where: { id: topUpId, status: "PENDING" },
      data: { status: "PAID", paidAt: now, paymentRef },
    });
    if (upd.count === 0) return null; // already processed -> idempotent no-op

    const topup = await tx.topUp.findUniqueOrThrow({ where: { id: topUpId } });
    const newBalance = await creditBalanceTx(
      tx,
      topup.userId,
      topup.amount,
      "TOPUP",
      null,
      topup.id,
    );
    return { userId: topup.userId, amount: topup.amount, newBalance };
  });
}
