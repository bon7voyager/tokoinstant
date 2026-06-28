"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { creditBalanceTx } from "@/lib/wallet";
import { reverseReferralRewardTx } from "@/lib/referral";
import { notifyOrderRefunded, notifyOrderWarranty } from "@/lib/notify";

export type RefundState = { error?: string; success?: string } | undefined;

/**
 * Refund a COMPLETED order: return the paid amount to the buyer's wallet as
 * store credit and mark the order REFUNDED. Delivered credentials are left as-is
 * (the buyer already received them). Concurrency-safe: only the call that wins
 * the status flip credits + notifies.
 */
export async function refundOrderAction(
  _prev: RefundState,
  formData: FormData,
): Promise<RefundState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Refund oleh admin";

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Pesanan tidak ditemukan." };
  if (order.status !== "COMPLETED" && order.status !== "PAID") {
    return { error: "Hanya pesanan yang sudah dibayar yang bisa direfund." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Guard against double-refund: only flip an order that is still paid/completed.
      const upd = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["COMPLETED", "PAID"] } },
        data: { status: "REFUNDED" },
      });
      if (upd.count === 0) throw new Error("ALREADY_REFUNDED");

      if (order.total > 0) {
        await creditBalanceTx(
          tx,
          order.userId,
          order.total,
          "REFUND",
          `Refund ${order.orderNumber}: ${reason}`,
          order.orderNumber,
        );
      }

      // If this order is the one that earned a referral bonus, claw the bonus back
      // so a refund can't return the purchase money AND keep the referral reward.
      await reverseReferralRewardTx(tx, order.id);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_REFUNDED") {
      return { error: "Pesanan ini sudah direfund." };
    }
    throw e;
  }

  // Only the winning call reaches here → notifies exactly once.
  try {
    await notifyOrderRefunded(order.id, reason);
  } catch (e) {
    console.error("[notify] refund failed", e);
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  return {
    success:
      order.total > 0
        ? "Pesanan direfund. Saldo dikembalikan ke pembeli."
        : "Pesanan ditandai refund (tidak ada dana untuk dikembalikan).",
  };
}

/**
 * Warranty replacement: deliver fresh stock for a COMPLETED order without
 * charging again. The previously delivered units are marked superseded
 * (replacedAt) so the buyer only sees the live credentials.
 */
export async function replaceOrderStockAction(
  _prev: RefundState,
  formData: FormData,
): Promise<RefundState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Penggantian garansi";
  const now = new Date();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Pesanan tidak ditemukan." };
  if (order.status !== "COMPLETED") {
    return { error: "Garansi hanya untuk pesanan yang sudah Selesai." };
  }

  let newSecrets: string[] = [];
  try {
    newSecrets = await prisma.$transaction(async (tx) => {
      // Supersede the currently-live delivered units for this order.
      await tx.stock.updateMany({
        where: { orderId: order.id, status: "SOLD", replacedAt: null },
        data: { replacedAt: now },
      });

      const stocks = await tx.stock.findMany({
        where: { productId: order.productId, variantId: order.variantId ?? null, status: "AVAILABLE" },
        orderBy: { createdAt: "asc" },
        take: order.quantity,
      });
      if (stocks.length < order.quantity) throw new Error("OUT_OF_STOCK");

      const ids = stocks.map((s) => s.id);
      const reserved = await tx.stock.updateMany({
        where: { id: { in: ids }, status: "AVAILABLE" },
        data: { status: "SOLD", orderId: order.id, note: `Garansi: ${reason}` },
      });
      if (reserved.count < order.quantity) throw new Error("OUT_OF_STOCK");

      return stocks.map((s) => s.secret);
    });
  } catch (e) {
    if (e instanceof Error && e.message === "OUT_OF_STOCK") {
      return { error: "Stok pengganti habis. Tambah stok dulu." };
    }
    throw e;
  }

  try {
    await notifyOrderWarranty(order.id, newSecrets);
  } catch (e) {
    console.error("[notify] warranty failed", e);
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath(`/dashboard/orders/${order.id}`);
  return { success: `${order.quantity} akun pengganti dikirim ke pembeli.` };
}
