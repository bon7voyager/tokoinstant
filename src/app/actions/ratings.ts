"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type RatingState = { error?: string; success?: string } | undefined;

/** Buyer rates a received order (1-5 stars + optional comment). One per order. */
export async function rateOrderAction(
  _prev: RatingState,
  formData: FormData,
): Promise<RatingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Silakan login dulu." };

  const orderId = String(formData.get("orderId") ?? "");
  const starsRaw = Number(formData.get("stars") ?? 0);
  if (!Number.isFinite(starsRaw) || starsRaw < 1) return { error: "Pilih jumlah bintang dulu." };
  const stars = Math.max(1, Math.min(5, Math.trunc(starsRaw)));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 500) || null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { rating: true },
  });
  if (!order || order.userId !== user.id) return { error: "Pesanan tidak ditemukan." };
  if (order.status !== "COMPLETED") {
    return { error: "Hanya pesanan yang sudah selesai yang bisa dinilai." };
  }
  if (order.rating) return { error: "Pesanan ini sudah dinilai." };

  // A null result means the unique-orderId race fired (e.g. auto-rate landed
  // first) — tell the user rather than claiming a false success.
  const created = await prisma.rating
    .create({
      data: { orderId: order.id, userId: user.id, productId: order.productId, stars, comment, isAuto: false },
    })
    .catch(() => null);
  if (!created) return { error: "Pesanan ini sudah dinilai." };

  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/");
  return { success: "Terima kasih atas penilaianmu! ⭐" };
}
