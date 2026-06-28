// Premium / reseller membership helpers. Server-side (admin setting > env > default).

import { cfg } from "@/lib/settings-store";

function num(v: string | undefined, fallback: number, min: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export function premiumConfig() {
  const fee = num(cfg("PREMIUM_FEE"), 50000, 1); // upfront upgrade fee (IDR); ≥1
  const days = num(cfg("PREMIUM_DAYS"), 30, 1); // membership duration per purchase; ≥1
  // 0 is a valid percent (disables the reseller discount); only reject negatives/NaN.
  const percentRaw = num(cfg("RESELLER_DISCOUNT_PERCENT"), 10, 0);
  const percent = Math.min(90, Math.max(0, percentRaw)); // reseller discount %
  return { fee, days, percent };
}

export function resellerPercent() {
  return premiumConfig().percent;
}

/** True if the user currently has an active premium/reseller membership. */
export function isPremium(
  user: { premiumUntil: Date | null } | null | undefined,
): boolean {
  return !!user?.premiumUntil && user.premiumUntil.getTime() > Date.now();
}

/** Clamp a reseller discount percent into the allowed 0..90 range. */
export function clampResellerPercent(p: number): number {
  return Math.min(90, Math.max(0, Math.round(p)));
}

/** The price a given user pays: reseller-discounted for premium members.
 * `percentOverride` (a product's own reseller %) wins over the global default;
 * pass null/undefined to fall back to the global `RESELLER_DISCOUNT_PERCENT`. */
export function resellerPrice(
  listPrice: number,
  premium: boolean,
  percentOverride?: number | null,
): number {
  if (!premium) return listPrice;
  const percent =
    percentOverride === undefined || percentOverride === null
      ? premiumConfig().percent
      : clampResellerPercent(percentOverride);
  return Math.max(0, Math.round((listPrice * (100 - percent)) / 100));
}
