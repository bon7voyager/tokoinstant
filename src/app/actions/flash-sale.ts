"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export type FlashState = { error?: string; success?: string } | undefined;

// <input type="datetime-local"> has no timezone; interpret it as WIB (+07:00,
// Indonesia has no DST) so the window is correct regardless of server timezone.
function parseWIB(s: string): Date | null {
  if (!s) return null;
  const withSec = /T\d{2}:\d{2}:\d{2}/.test(s) ? s : `${s}:00`;
  const d = new Date(`${withSec}+07:00`);
  return Number.isNaN(+d) ? null : d;
}

export async function createFlashSaleAction(
  _prev: FlashState,
  formData: FormData,
): Promise<FlashState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Nama wajib (maks 60 karakter)." };

  const startsAt = parseWIB(String(formData.get("startsAt") ?? ""));
  const endsAt = parseWIB(String(formData.get("endsAt") ?? ""));
  if (!startsAt || !endsAt) return { error: "Tanggal mulai/berakhir tidak valid." };
  if (endsAt <= startsAt) return { error: "Waktu berakhir harus setelah waktu mulai." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Data produk tidak valid." };
  }
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const items: { productId: string; percent: number }[] = [];
  for (const it of list) {
    const pid = typeof it?.productId === "string" ? it.productId : "";
    const pct = Number(it?.percent);
    if (!pid || seen.has(pid)) continue;
    if (!Number.isInteger(pct) || pct < 1 || pct > 90) continue;
    seen.add(pid);
    items.push({ productId: pid, percent: pct });
  }
  if (items.length === 0)
    return { error: "Pilih minimal 1 produk dengan diskon 1–90%." };

  // Keep only items whose product actually exists & is active (avoid a FK throw
  // on a forged/stale productId).
  const valid = new Set(
    (
      await prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, isActive: true },
        select: { id: true },
      })
    ).map((p) => p.id),
  );
  const finalItems = items.filter((i) => valid.has(i.productId));
  if (finalItems.length === 0)
    return { error: "Produk tidak ditemukan atau tidak aktif." };

  await prisma.flashSale.create({
    data: { name, startsAt, endsAt, items: { create: finalItems } },
  });

  revalidatePath("/admin/flash-sale");
  revalidatePath("/");
  return { success: `Flash sale dibuat dengan ${finalItems.length} produk.` };
}

export async function toggleFlashSaleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fs = await prisma.flashSale.findUnique({ where: { id }, select: { isActive: true } });
  if (fs) {
    await prisma.flashSale.update({ where: { id }, data: { isActive: !fs.isActive } });
  }
  revalidatePath("/admin/flash-sale");
  revalidatePath("/");
}

export async function deleteFlashSaleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.flashSale.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/flash-sale");
  revalidatePath("/");
}
