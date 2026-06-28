import "server-only";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { callbackUrlError } from "@/lib/ssrf";

/** Buyer-facing status the reseller's system reacts to. */
function mapStatus(s: string): string {
  switch (s) {
    case "COMPLETED":
      return "completed"; // delivered (account ready)
    case "PAID":
      return "processing"; // manual product paid, awaiting admin delivery
    case "FAILED":
      return "failed"; // paid but couldn't fulfil -> refund
    case "EXPIRED":
      return "expired";
    case "REFUNDED":
      return "refunded";
    default:
      return s.toLowerCase();
  }
}

/**
 * Notify a reseller's webhook about one of their API orders changing state.
 * No-op for non-API orders or resellers without a callback URL. Fire-and-forget:
 * never throws, retries a few times, and signs the body with the reseller's
 * secret (header `x-kilat-signature` = HMAC-SHA256 hex of the raw body).
 */
export async function fireResellerCallback(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: { select: { name: true } },
        deliveredStocks: { select: { secret: true } },
        user: { select: { apiCallbackUrl: true, apiCallbackSecret: true } },
      },
    });
    if (!order || order.source !== "API" || !order.user.apiCallbackUrl) return;

    const log = (
      status: "SENT" | "FAILED",
      httpStatus: number | null,
      attempts: number,
      error: string | null,
    ) =>
      prisma.apiCallbackLog
        .create({
          data: {
            userId: order.userId,
            orderNumber: order.orderNumber,
            event: "order.update",
            status,
            httpStatus,
            attempts,
            error,
          },
        })
        .catch(() => {});

    // Re-validate against SSRF at send time (DNS may have changed since save):
    // never POST account credentials to an internal/private/non-https target.
    const ssrfErr = await callbackUrlError(order.user.apiCallbackUrl);
    if (ssrfErr) {
      console.warn("[reseller-callback] blocked unsafe url:", order.orderNumber, ssrfErr);
      await log("FAILED", null, 0, `URL diblokir: ${ssrfErr}`);
      return;
    }

    const account = order.deliveredStocks.length
      ? order.deliveredStocks.map((s) => s.secret).join("\n")
      : null;

    const body = JSON.stringify({
      event: "order.update",
      order_ref: order.externalRef ?? "",
      order_number: order.orderNumber,
      status: mapStatus(order.status),
      product: order.product.name,
      total: order.total,
      account,
      delivered_at: order.completedAt ? order.completedAt.toISOString() : null,
      created_at: order.createdAt.toISOString(),
    });

    const signature = createHmac("sha256", order.user.apiCallbackSecret ?? "")
      .update(body)
      .digest("hex");

    let lastStatus: number | null = null;
    let lastError: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(order.user.apiCallbackUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-kilat-event": "order.update",
            "x-kilat-signature": signature,
          },
          body,
          redirect: "manual", // a 3xx must not bounce us onto an internal host
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          await log("SENT", res.status, attempt, null);
          return;
        }
        lastStatus = res.status;
        lastError = `HTTP ${res.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "network error";
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    await log("FAILED", lastStatus, 3, lastError);
    console.warn("[reseller-callback] failed after retries:", order.orderNumber);
  } catch (e) {
    console.error("[reseller-callback] error:", e);
  }
}
