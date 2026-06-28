"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { refreshSettings } from "@/lib/settings-store";

export type ResellerState = { error?: string; success?: string } | undefined;

async function setKey(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Save the global reseller-program config: upgrade fee, duration, default discount %.
 * These are the same Setting keys the rest of the app reads via premiumConfig(). */
export async function saveResellerConfigAction(
  _prev: ResellerState,
  formData: FormData,
): Promise<ResellerState> {
  await requireAdmin();
  const fee = String(formData.get("PREMIUM_FEE") ?? "").trim();
  const days = String(formData.get("PREMIUM_DAYS") ?? "").trim();
  const disc = String(formData.get("RESELLER_DISCOUNT_PERCENT") ?? "").trim();

  // Strict plain-decimal validation (server actions accept arbitrary FormData).
  if (!/^\d+$/.test(fee) || Number(fee) < 1)
    return { error: "Biaya upgrade harus angka ≥ 1." };
  if (!/^\d+$/.test(days) || Number(days) < 1)
    return { error: "Durasi harus angka ≥ 1 hari." };
  if (!/^\d{1,2}$/.test(disc) || Number(disc) > 90)
    return { error: "Diskon default harus angka 0–90." };

  try {
    await setKey("PREMIUM_FEE", fee);
    await setKey("PREMIUM_DAYS", days);
    await setKey("RESELLER_DISCOUNT_PERCENT", disc);
  } catch (e) {
    console.error("[reseller] config save failed", e);
    return { error: "Gagal menyimpan konfigurasi. Coba lagi." };
  }

  await refreshSettings();
  revalidatePath("/admin/membership");
  revalidatePath("/"); // homepage shows the fee & discount headline
  return { success: "Konfigurasi reseller tersimpan & langsung aktif." };
}

/** Bulk-set each product's per-product reseller discount %. Reads every `rp_<id>`
 * field: blank = inherit the global default (null); 0..90 = override; 0 disables. */
export async function saveBulkResellerDiscountAction(
  _prev: ResellerState,
  formData: FormData,
): Promise<ResellerState> {
  await requireAdmin();

  const updates: { id: string; value: number | null }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("rp_")) continue;
    const id = key.slice(3);
    const s = String(raw).trim();
    let value: number | null = null;
    if (s !== "") {
      if (!/^\d{1,2}$/.test(s) || Number(s) > 90) {
        return { error: "Ada diskon produk yang tidak valid (harus 0–90)." };
      }
      value = Number(s);
    }
    updates.push({ id, value });
  }
  if (updates.length === 0) return { error: "Tidak ada produk untuk disimpan." };

  try {
    // updateMany (not update) so a product deleted between page render and submit
    // is a harmless no-op instead of a P2025 that would roll back every other edit.
    await prisma.$transaction(
      updates.map((u) =>
        prisma.product.updateMany({
          where: { id: u.id },
          data: { resellerPercent: u.value },
        }),
      ),
    );
  } catch (e) {
    console.error("[reseller] bulk discount save failed", e);
    return { error: "Gagal menyimpan diskon produk. Coba lagi." };
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { success: `Diskon ${updates.length} produk tersimpan.` };
}
