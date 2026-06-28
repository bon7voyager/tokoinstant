import "server-only";
import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { cfg } from "@/lib/settings-store";
import { creditBalanceTx, debitBalanceTx } from "@/lib/wallet";
import { normalizeEmail } from "@/lib/utils";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
const REF_COOKIE = "kilat_ref";

/** Referral bonuses + anti-abuse gates (admin setting > env > default), in IDR. */
export function referralConfig() {
  const num = (v: string | undefined, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fb;
  };
  const referrerBonus = num(cfg("REFERRAL_REFERRER_BONUS"), 5000);
  const refereeBonus = num(cfg("REFERRAL_REFEREE_BONUS"), 5000);
  // A referral only pays out on an order worth at least the credit it mints, so a
  // reward can never exceed the money its qualifying purchase brought in. Admins can
  // raise REFERRAL_MIN_ORDER for extra margin; it can never drop below the bonus sum.
  const minQualifyingTotal = Math.max(num(cfg("REFERRAL_MIN_ORDER"), 0), referrerBonus + refereeBonus);
  // The referrer earns their bonus only if they're a real customer (≥1 paid order).
  // Set REFERRAL_REFERRER_REQUIRE_PURCHASE=0 to pay referrers who haven't bought yet.
  const referrerRequirePurchase = (cfg("REFERRAL_REFERRER_REQUIRE_PURCHASE") ?? "1") !== "0";
  // Cap how many referrals one referrer can be REWARDED for within a rolling window
  // (0 = unlimited). Limits how fast a single account can farm referrer bonuses.
  const maxPerPeriod = num(cfg("REFERRAL_MAX_PER_PERIOD"), 0);
  const periodDays = Math.max(1, num(cfg("REFERRAL_PERIOD_DAYS"), 30));
  // Skip the referral when referrer & referee signed up from the same IP (likely the
  // same person). Soft guard — set REFERRAL_BLOCK_SAME_IP=0 to disable (e.g. lots of
  // legit users behind one office/household NAT).
  const blockSameIp = (cfg("REFERRAL_BLOCK_SAME_IP") ?? "1") !== "0";
  return {
    referrerBonus,
    refereeBonus,
    minQualifyingTotal,
    referrerRequirePurchase,
    maxPerPeriod,
    periodDays,
    blockSameIp,
  };
}

function randomCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Ensure the user has a referral code (generated on first call, retried on clash). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (u?.referralCode) return u.referralCode;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: randomCode() },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      const again = await prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });
      if (again?.referralCode) return again.referralCode; // a concurrent call won
    }
  }
  throw new Error("REFERRAL_CODE_GEN_FAILED");
}

/** Record a referral for a freshly-created user from a code. Best-effort + idempotent
 * (no self-referral; referredId is unique so a user is referred at most once). */
export async function attachReferral(referredId: string, code: string): Promise<void> {
  const c = code.trim().toUpperCase();
  if (!c) return;
  try {
    const [referrer, referred] = await Promise.all([
      prisma.user.findUnique({
        where: { referralCode: c },
        select: { id: true, email: true, signupIp: true },
      }),
      prisma.user.findUnique({
        where: { id: referredId },
        select: { email: true, signupIp: true },
      }),
    ]);
    if (!referrer || !referred || referrer.id === referredId) return;
    // Same person via a second account: a matching normalized email = same inbox.
    if (normalizeEmail(referrer.email) === normalizeEmail(referred.email)) return;
    // Soft self-dealing guard: same signup IP (configurable; nulls never match).
    const { blockSameIp } = referralConfig();
    if (
      blockSameIp &&
      referrer.signupIp &&
      referred.signupIp &&
      referrer.signupIp === referred.signupIp
    ) {
      return;
    }
    await prisma.referral.create({ data: { referrerId: referrer.id, referredId } });
  } catch {
    /* unknown code / already referred -> ignore */
  }
}

/** Read the referral cookie set by /r/<code> and attach it to a new user, then clear it. */
export async function attachReferralFromCookie(referredId: string): Promise<void> {
  try {
    const store = await cookies();
    const code = store.get(REF_COOKIE)?.value;
    if (!code) return;
    await attachReferral(referredId, code);
    store.delete(REF_COOKIE);
  } catch {
    /* cookie unavailable -> ignore */
  }
}

/**
 * Reward both parties when the referred user completes their FIRST order. The
 * PENDING-status atomic claim makes this idempotent across the multiple order
 * completion paths. Fire-and-forget (never throws).
 */
export async function processReferralReward(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, status: true, total: true },
    });
    if (!order || order.status !== "COMPLETED") return;

    const {
      referrerBonus,
      refereeBonus,
      minQualifyingTotal,
      referrerRequirePurchase,
      maxPerPeriod,
      periodDays,
    } = referralConfig();
    // Require a real paid order worth at least the combined bonus: a 100%-off coupon
    // (total 0) can't farm bonuses, and the reward never exceeds the purchase funding it.
    if (order.total < minQualifyingTotal) return;

    const referral = await prisma.referral.findUnique({ where: { referredId: order.userId } });
    if (!referral || referral.status !== "PENDING") return;

    // The referrer earns the referrer-side bonus only if THEY are a real customer
    // (≥1 completed paid order) — stops a throwaway "main" account from harvesting
    // referrer bonuses without ever buying. The referee still gets the welcome bonus.
    const referrerIsCustomer =
      !referrerRequirePurchase ||
      (await prisma.order.count({
        where: { userId: referral.referrerId, status: "COMPLETED", total: { gt: 0 } },
      })) > 0;

    // Per-referrer rate cap: don't pay the referrer bonus once they've hit the limit
    // of REWARDED referrals in the rolling window (the referee still gets welcomed).
    const referrerUnderCap =
      maxPerPeriod <= 0 ||
      (await prisma.referral.count({
        where: {
          referrerId: referral.referrerId,
          status: "REWARDED",
          rewardedAt: { gte: new Date(Date.now() - periodDays * 86_400_000) },
        },
      })) < maxPerPeriod;

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.referral.updateMany({
        where: { id: referral.id, status: "PENDING" },
        data: { status: "REWARDED", rewardedAt: new Date(), rewardOrderId: orderId },
      });
      if (claimed.count === 0) return; // already rewarded by a concurrent run
      if (referrerBonus > 0 && referrerIsCustomer && referrerUnderCap) {
        await creditBalanceTx(
          tx,
          referral.referrerId,
          referrerBonus,
          "ADJUSTMENT",
          "Bonus referral (teman belanja pertama)",
          `REFR:${referral.id}`, // referrer-side credit
        );
      }
      if (refereeBonus > 0) {
        await creditBalanceTx(
          tx,
          referral.referredId,
          refereeBonus,
          "ADJUSTMENT",
          "Bonus referral (selamat datang)",
          `REFE:${referral.id}`, // referee-side credit
        );
      }
    });
  } catch (e) {
    console.error("[referral] reward failed", e);
  }
}

/**
 * Undo a referral reward when its qualifying order is refunded: revert the referral
 * to PENDING and claw back the still-outstanding bonus from each party. Reuses the
 * REFR:/REFE: ledger refs so each referral's ledger nets to zero. Best-effort — if a
 * party already spent the bonus, debitBalanceTx leaves their balance untouched rather
 * than going negative, so the refund itself is never blocked. Must run inside a $transaction.
 */
export async function reverseReferralRewardTx(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const referral = await tx.referral.findFirst({
    where: { rewardOrderId: orderId, status: "REWARDED" },
  });
  if (!referral) return;

  await tx.referral.update({
    where: { id: referral.id },
    data: { status: "PENDING", rewardedAt: null, rewardOrderId: null },
  });

  for (const [userId, ref] of [
    [referral.referrerId, `REFR:${referral.id}`],
    [referral.referredId, `REFE:${referral.id}`],
  ] as const) {
    // Net of credits minus any prior reversals → the amount still owed back.
    const net = await tx.balanceTransaction.aggregate({ where: { ref }, _sum: { amount: true } });
    const owed = net._sum.amount ?? 0;
    if (owed > 0) {
      await debitBalanceTx(
        tx,
        userId,
        owed,
        "ADJUSTMENT",
        "Pembatalan bonus referral (pesanan direfund)",
        ref,
      );
    }
  }
}
