// Pure coupon evaluation — NO database access. Safe to call anywhere.

import { formatIDR } from "@/lib/utils";

export type CouponEvalInput = {
  type: "PERCENT" | "FIXED";
  value: number;
  minSpend: number;
  maxDiscount: number | null;
  quota: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | null;
};

export type CouponEval =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

export function evaluateCoupon(
  c: CouponEvalInput,
  subtotal: number,
  now: Date = new Date(),
): CouponEval {
  if (!c.isActive) return { ok: false, reason: "Kupon tidak aktif." };
  if (c.expiresAt && c.expiresAt < now)
    return { ok: false, reason: "Kupon sudah kedaluwarsa." };
  if (c.quota !== null && c.usedCount >= c.quota)
    return { ok: false, reason: "Kuota kupon sudah habis." };
  if (subtotal < c.minSpend)
    return {
      ok: false,
      reason: `Minimal belanja ${formatIDR(c.minSpend)} untuk pakai kupon ini.`,
    };

  let discount =
    c.type === "PERCENT" ? Math.floor((subtotal * c.value) / 100) : c.value;

  if (c.type === "PERCENT" && c.maxDiscount != null)
    discount = Math.min(discount, c.maxDiscount);

  discount = Math.min(discount, subtotal); // never exceed subtotal -> total >= 0

  if (discount <= 0)
    return { ok: false, reason: "Kupon tidak memberi potongan untuk pesanan ini." };

  return { ok: true, discount };
}

export function couponLabel(type: "PERCENT" | "FIXED", value: number) {
  return type === "PERCENT" ? `${value}%` : formatIDR(value);
}
