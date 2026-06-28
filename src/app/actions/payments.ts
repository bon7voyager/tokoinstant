"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentProvider, isSimulation } from "@/lib/payment";
import { orderExpiryDate } from "@/lib/orders";

export type GatewayStartState =
  | {
      error?: string;
      instruction?: {
        redirectUrl?: string | null;
        qrString?: string | null;
        qrImageUrl?: string | null;
        payCode?: string | null;
      };
    }
  | undefined;

/**
 * Start a real-gateway payment for an order: create a charge at the provider,
 * store its reference, then send the buyer to the hosted payment page.
 * Completion happens asynchronously via the gateway webhook.
 */
export async function startOrderGatewayAction(
  _prev: GatewayStartState,
  formData: FormData,
): Promise<GatewayStartState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) return { error: "Pesanan tidak ditemukan." };
  if (order.status !== "PENDING") return { error: "Pesanan ini sudah diproses." };
  if (order.expiresAt && order.expiresAt < new Date()) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
    return { error: "Batas waktu pembayaran sudah lewat. Pesanan dibatalkan." };
  }
  if (order.payMethod !== "GATEWAY") return { error: "Metode pembayaran tidak sesuai." };

  if (isSimulation()) {
    return { error: "Mode simulasi aktif — gunakan tombol bayar simulasi." };
  }

  const provider = getPaymentProvider();
  let charge;
  try {
    charge = await provider.createCharge({
      purpose: "ORDER",
      merchantRef: order.orderNumber,
      amount: order.total,
      customer: { name: user.name, email: user.email, phone: user.phone },
      itemName: `Pesanan ${order.orderNumber}`,
    });
  } catch (e) {
    console.error("[payment] createCharge failed", e);
    return { error: "Gagal membuat transaksi pembayaran. Coba lagi." };
  }

  // Give a fresh payment window now that the buyer is actually paying.
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRef: charge.ref, expiresAt: orderExpiryDate() },
  });

  if (charge.redirectUrl) redirect(charge.redirectUrl);

  return {
    instruction: {
      qrString: charge.qrString,
      qrImageUrl: charge.qrImageUrl,
      payCode: charge.payCode,
    },
  };
}
