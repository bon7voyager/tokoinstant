"use server";

import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getRecentTransactions, type RecentTxn } from "@/lib/transactions";

export type TrackedOrder = {
  orderNumber: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
};

export type TrackState = { error?: string; order?: TrackedOrder } | undefined;

/**
 * Public order tracker: look up a PRODUCT order by invoice number. Never exposes
 * the delivered credentials nor the buyer's identity (no name/email/phone), and
 * only covers Order — membership purchases are a separate model, not surfaced.
 * Rate-limited per IP to bound enumeration.
 */
export async function trackOrderAction(
  _prev: TrackState,
  formData: FormData,
): Promise<TrackState> {
  const invoice = String(formData.get("invoice") ?? "").trim().toUpperCase();
  if (!invoice) return { error: "Isi nomor invoice kamu." };

  const ip = await clientIp();
  if (!rateLimit(`track:ip:${ip}`, 60, 10 * 60_000)) {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: invoice },
    select: {
      orderNumber: true,
      quantity: true,
      total: true,
      status: true,
      createdAt: true,
      paidAt: true,
      completedAt: true,
      variantName: true,
      product: { select: { name: true } },
    },
  });
  if (!order) {
    return { error: "Pesanan tidak ditemukan. Pastikan nomor invoice benar." };
  }

  return {
    order: {
      orderNumber: order.orderNumber,
      productName: order.product.name,
      variantName: order.variantName,
      quantity: order.quantity,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      completedAt: order.completedAt?.toISOString() ?? null,
    },
  };
}

/** Masked recent product transactions for the live feed (polled by the client). */
export async function recentTransactionsAction(): Promise<RecentTxn[]> {
  const ip = await clientIp();
  if (!rateLimit(`txnfeed:ip:${ip}`, 80, 10 * 60_000)) return [];
  return getRecentTransactions();
}
