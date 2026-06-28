import "server-only";
import { prisma } from "@/lib/prisma";
import type { WebhookResult } from "./types";
import { settleOrderTransaction } from "@/lib/order-settle";
import { settleTopUpTransaction } from "@/lib/topup-settle";
import { settleMembershipTransaction } from "@/lib/membership-settle";
import { fireResellerCallback } from "@/lib/reseller-callback";
import { processReferralReward } from "@/lib/referral";
import {
  notifyOrderCompleted,
  notifyOrderPaid,
  notifyAdminNewOrder,
  notifyTopupSuccess,
  notifyMembershipActive,
} from "@/lib/notify";

/**
 * Apply a verified webhook result to our domain. Idempotent and tamper-resistant:
 * trusts our stored amount over the gateway's. Returns the HTTP response to send.
 */
export async function handleWebhookResult(
  result: WebhookResult,
): Promise<{ status: number; body: unknown }> {
  if (!result.ok) {
    return { status: result.httpStatus, body: result.responseBody };
  }

  const ref = result.merchantRef ?? "";
  const gatewayRef = result.gatewayRef || ref;

  // Non-PAID outcomes: mark expired/failed where applicable, then ack.
  if (result.status !== "PAID") {
    if (ref.startsWith("TOP-")) {
      const id = ref.slice(4);
      if (result.status === "EXPIRED" || result.status === "FAILED") {
        await prisma.topUp.updateMany({
          where: { id, status: "PENDING" },
          data: { status: result.status },
        });
      }
    } else if (ref.startsWith("MEM-")) {
      const id = ref.slice(4);
      if (result.status === "EXPIRED" || result.status === "FAILED") {
        await prisma.membershipPurchase.updateMany({
          where: { id, status: "PENDING" },
          data: { status: result.status },
        });
      }
    } else if (ref) {
      if (result.status === "EXPIRED" || result.status === "FAILED") {
        await prisma.order.updateMany({
          where: { orderNumber: ref, status: "PENDING" },
          data: { status: result.status },
        });
      }
    }
    return { status: 200, body: { received: true } };
  }

  // PAID — fulfil.
  if (ref.startsWith("TOP-")) {
    const id = ref.slice(4);
    const topup = await prisma.topUp.findUnique({ where: { id } });
    if (!topup) return { status: 200, body: { received: true } }; // unknown -> ack

    // Amount tamper guard — require a positive, matching amount before crediting.
    if (!Number.isFinite(result.amount) || result.amount !== topup.amount) {
      console.error("[webhook] topup amount invalid/mismatch", { id, expected: topup.amount, got: result.amount });
      return { status: 200, body: { received: true } };
    }

    const settled = await settleTopUpTransaction(id, gatewayRef);
    if (settled) {
      try {
        await notifyTopupSuccess({
          userId: settled.userId,
          nominal: settled.amount,
          newBalance: settled.newBalance,
          ref: id,
        });
      } catch (e) {
        console.error("[notify] topup webhook failed", e);
      }
    }
    return { status: 200, body: { received: true } };
  }

  // Membership purchase
  if (ref.startsWith("MEM-")) {
    const id = ref.slice(4);
    const purchase = await prisma.membershipPurchase.findUnique({ where: { id } });
    if (!purchase) return { status: 200, body: { received: true } }; // unknown -> ack

    // Amount tamper guard — require a positive, matching amount before activating.
    if (!Number.isFinite(result.amount) || result.amount !== purchase.amount) {
      console.error("[webhook] membership amount invalid/mismatch", { id, expected: purchase.amount, got: result.amount });
      return { status: 200, body: { received: true } };
    }

    const settled = await settleMembershipTransaction(id, {
      useBalance: false,
      paymentRef: gatewayRef,
      payMethod: "GATEWAY",
    });
    if (settled) {
      try {
        await notifyMembershipActive(settled);
      } catch (e) {
        console.error("[notify] membership webhook failed", e);
      }
    }
    return { status: 200, body: { received: true } };
  }

  // Order
  const order = await prisma.order.findUnique({ where: { orderNumber: ref } });
  if (!order) return { status: 200, body: { received: true } }; // unknown -> ack

  // Amount tamper guard — require a positive, matching amount before fulfilling.
  if (!Number.isFinite(result.amount) || result.amount !== order.total) {
    console.error("[webhook] order amount invalid/mismatch", { ref, expected: order.total, got: result.amount });
    return { status: 200, body: { received: true } };
  }

  try {
    await settleOrderTransaction(order.id, {
      useBalance: false,
      paymentRef: gatewayRef,
      payMethod: "GATEWAY",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_PROCESSED") {
      return { status: 200, body: { received: true } }; // idempotent
    }
    if (msg === "OUT_OF_STOCK" || msg === "COUPON_EXHAUSTED" || msg === "COUPON_INVALID") {
      // Funds received but cannot fulfil -> flag for manual refund.
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      console.error("[webhook] paid but not fulfilled:", msg, order.orderNumber);
      fireResellerCallback(order.id); // notify reseller of the failure (API orders)
      return { status: 200, body: { received: true, warning: msg } };
    }
    throw e;
  }

  try {
    await notifyOrderCompleted(order.id); // auto products (delivered)
    await notifyOrderPaid(order.id); // manual products (awaiting delivery)
    await notifyAdminNewOrder(order.id); // alert the admin a paid order came in
  } catch (e) {
    console.error("[notify] order webhook failed", e);
  }

  // API order: tell the reseller (completed for auto, processing for manual).
  fireResellerCallback(order.id);
  // Referral reward on the buyer's first completed order (idempotent).
  processReferralReward(order.id);

  return { status: 200, body: { received: true } };
}
