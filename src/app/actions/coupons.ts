"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { evaluateCoupon } from "@/lib/coupons";

/* ----------------------------- Preview (user) ----------------------------- */

export type CouponPreviewState =
  | { error?: string; applied?: { code: string; discount: number; total: number } }
  | undefined;

export async function applyCouponAction(
  _prev: CouponPreviewState,
  formData: FormData,
): Promise<CouponPreviewState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const subtotal = Math.max(0, Math.floor(Number(formData.get("subtotal") ?? 0)));

  if (!code) return { error: "Masukkan kode kupon." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { error: "Kupon tidak ditemukan." };

  const r = evaluateCoupon(coupon, subtotal);
  if (!r.ok) return { error: r.reason };

  return { applied: { code, discount: r.discount, total: subtotal - r.discount } };
}

/* ------------------------------- Admin CRUD ------------------------------- */

export type CouponAdminState = { error?: string; success?: string } | undefined;

const MAX_IDR = 1_000_000_000; // 1 miliar — batas wajar untuk mencegah nilai overflow

const couponSchema = z
  .object({
    code: z.string().trim().min(3, "Kode minimal 3 karakter").max(32, "Kode terlalu panjang"),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().int().positive("Nilai harus > 0").max(MAX_IDR, "Nilai terlalu besar"),
    minSpend: z.coerce.number().int().min(0).max(MAX_IDR).default(0),
    maxDiscount: z.coerce.number().int().min(0).max(MAX_IDR).optional(),
    quota: z.coerce.number().int().min(1).max(1_000_000).optional(),
    isActive: z.boolean().default(true),
    expiresAt: z.string().optional(),
  })
  .refine((d) => d.type !== "PERCENT" || (d.value >= 1 && d.value <= 100), {
    message: "Persen harus antara 1 dan 100",
    path: ["value"],
  });

function parseCouponForm(formData: FormData) {
  return couponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    minSpend: formData.get("minSpend") || 0,
    maxDiscount: formData.get("maxDiscount") || undefined,
    quota: formData.get("quota") || undefined,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    expiresAt: (formData.get("expiresAt") as string) || undefined,
  });
}

export async function createCouponAction(
  _prev: CouponAdminState,
  formData: FormData,
): Promise<CouponAdminState> {
  await requireAdmin();
  const parsed = parseCouponForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    await prisma.coupon.create({
      data: {
        code: d.code.toUpperCase(),
        type: d.type,
        value: d.value,
        minSpend: d.minSpend,
        maxDiscount: d.type === "PERCENT" ? (d.maxDiscount ?? null) : null,
        quota: d.quota ?? null,
        isActive: d.isActive,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "Kode kupon sudah dipakai." };
    }
    throw e;
  }

  revalidatePath("/admin/coupons");
  return { success: "Kupon berhasil dibuat." };
}

export async function updateCouponAction(
  _prev: CouponAdminState,
  formData: FormData,
): Promise<CouponAdminState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parseCouponForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    await prisma.coupon.update({
      where: { id },
      data: {
        code: d.code.toUpperCase(),
        type: d.type,
        value: d.value,
        minSpend: d.minSpend,
        maxDiscount: d.type === "PERCENT" ? (d.maxDiscount ?? null) : null,
        quota: d.quota ?? null,
        isActive: d.isActive,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "Kode kupon sudah dipakai." };
    }
    throw e;
  }

  revalidatePath("/admin/coupons");
  return { success: "Kupon diperbarui." };
}

export async function toggleCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (c) {
    await prisma.coupon.update({ where: { id }, data: { isActive: !c.isActive } });
  }
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const used = await prisma.order.count({ where: { couponId: id } });
  if (used > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.coupon.delete({ where: { id } });
  }
  revalidatePath("/admin/coupons");
}
