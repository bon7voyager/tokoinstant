import type { Prisma } from "@prisma/client";
import { cfg } from "@/lib/settings-store";

type Tx = Prisma.TransactionClient;

/** Top-up bounds & presets (admin setting > env > NaN-safe defaults). */
export function topupBounds() {
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  let min = num(cfg("TOPUP_MIN"), 10000);
  let max = num(cfg("TOPUP_MAX"), 5000000);
  if (min > max) [min, max] = [max, min];
  const presets = (cfg("TOPUP_PRESETS") ?? "20000,50000,100000,250000")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { min, max, presets: presets.length ? presets : [20000, 50000, 100000, 250000] };
}

/** Withdrawal bounds (admin setting > env > NaN-safe defaults). */
export function withdrawBounds() {
  const n = Number(cfg("WITHDRAW_MIN"));
  const min = Number.isFinite(n) && n > 0 ? n : 10000;
  return { min };
}

/**
 * Referral bonus credit that is NOT yet withdrawable. Referral bonuses (ledger refs
 * REFR:/REFE:) can be spent on purchases but not cashed out until "earned" — every
 * rupiah the user spends on a real purchase unlocks a rupiah of bonus. So:
 *   locked = max(0, netReferralCredit − totalPurchaseSpend)
 * Withdrawable balance = user.balance − locked. Reads work on a tx or the client.
 */
export async function referralLockedBalance(
  db: Pick<Tx, "balanceTransaction">,
  userId: string,
): Promise<number> {
  const [promo, spend] = await Promise.all([
    db.balanceTransaction.aggregate({
      where: { userId, OR: [{ ref: { startsWith: "REFR:" } }, { ref: { startsWith: "REFE:" } }] },
      _sum: { amount: true },
    }),
    db.balanceTransaction.aggregate({
      where: { userId, type: "PURCHASE" },
      _sum: { amount: true },
    }),
  ]);
  const netReferralCredit = promo._sum.amount ?? 0; // credits minus any reversals
  const purchaseSpend = -(spend._sum.amount ?? 0); // PURCHASE rows are negative
  return Math.max(0, netReferralCredit - purchaseSpend);
}

/**
 * Credit a user's balance and append a ledger row. Must run inside a $transaction.
 * Returns the new balance.
 */
export async function creditBalanceTx(
  tx: Tx,
  userId: string,
  amount: number, // > 0
  type: "TOPUP" | "REFUND" | "ADJUSTMENT",
  note?: string | null,
  ref?: string | null,
): Promise<number> {
  if (amount <= 0) throw new Error("creditBalanceTx: amount must be > 0");
  const u = await tx.user.update({
    where: { id: userId },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });
  await tx.balanceTransaction.create({
    data: { userId, type, amount, balanceAfter: u.balance, note, ref },
  });
  return u.balance;
}

/**
 * Race-safe debit. Returns the new balance, or `null` if the user has
 * insufficient funds (in which case NOTHING is mutated). Must run inside a
 * $transaction. The conditional updateMany is the atomicity primitive that
 * prevents double-spend across concurrent checkouts.
 */
export async function debitBalanceTx(
  tx: Tx,
  userId: string,
  amount: number, // > 0
  type: "PURCHASE" | "ADJUSTMENT" | "WITHDRAWAL",
  note?: string | null,
  ref?: string | null,
  reserve = 0, // require this much to remain after the debit (e.g. locked promo credit)
): Promise<number | null> {
  if (amount <= 0) throw new Error("debitBalanceTx: amount must be > 0");
  const res = await tx.user.updateMany({
    where: { id: userId, balance: { gte: amount + reserve } },
    data: { balance: { decrement: amount } },
  });
  if (res.count === 0) return null; // insufficient (after reserve) -> caller aborts
  const u = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { balance: true },
  });
  await tx.balanceTransaction.create({
    data: { userId, type, amount: -amount, balanceAfter: u.balance, note, ref },
  });
  return u.balance;
}
