import "server-only";
import { prisma } from "@/lib/prisma";
import { debitBalanceTx } from "@/lib/wallet";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stacking extension (admin renewal): extend from the later of now / current expiry.
 */
export function extendFrom(current: Date | null, days: number): Date {
  const now = Date.now();
  const base = current && current.getTime() > now ? current.getTime() : now;
  return new Date(base + days * DAY_MS);
}

/**
 * Settle a membership purchase: mark PAID + activate premium atomically. Idempotent
 * and stack-safe. NOT a server action (lives in a server-only module) so it can only
 * be invoked by trusted server code (the pay wrappers and the gateway webhook) —
 * never reachable directly from a client.
 *
 * - useBalance: debit the fee from the wallet inside the same transaction; a failed
 *   debit (insufficient) throws and rolls back the PAID claim.
 * - Already-active guard: a balance payment for an already-premium user throws
 *   ALREADY_PREMIUM (no double-debit). The grant itself is non-stacking — it never
 *   adds a second period on top of an active one (max of current expiry vs now+days),
 *   so concurrent/duplicate settlements can't inflate the membership duration.
 *
 * Returns activation info for notification, or null if already processed.
 */
export async function settleMembershipTransaction(
  purchaseId: string,
  opts: { useBalance: boolean; paymentRef: string | null; payMethod: "BALANCE" | "GATEWAY" },
): Promise<{ userId: string; days: number; premiumUntil: Date } | null> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const claim = await tx.membershipPurchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: { status: "PAID", paidAt: now, paymentRef: opts.paymentRef, payMethod: opts.payMethod },
    });
    if (claim.count === 0) return null; // already processed -> idempotent no-op

    const purchase = await tx.membershipPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: purchase.userId } });

    const alreadyActive =
      !!user.premiumUntil && user.premiumUntil.getTime() > now.getTime();

    if (opts.useBalance) {
      // Don't charge an already-active reseller again (defuses the concurrent
      // double-debit / multi-pending race; SQLite serializes the writers).
      if (alreadyActive) throw new Error("ALREADY_PREMIUM");
      const bal = await debitBalanceTx(
        tx,
        user.id,
        purchase.amount,
        "PURCHASE",
        "Upgrade Member Premium (Reseller)",
        `MEM-${purchase.id}`,
      );
      if (bal === null) throw new Error("INSUFFICIENT_BALANCE"); // rolls back the claim
    }

    // Non-stacking grant: at least `days` from now, but never extend an already
    // longer active membership (so duplicate settlements can't stack duration).
    const target = now.getTime() + purchase.days * DAY_MS;
    const premiumUntil = new Date(Math.max(user.premiumUntil?.getTime() ?? 0, target));
    await tx.user.update({ where: { id: user.id }, data: { premiumUntil } });

    return { userId: user.id, days: purchase.days, premiumUntil };
  });
}
