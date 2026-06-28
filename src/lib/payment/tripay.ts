import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreateChargeInput,
  ChargeResult,
  WebhookResult,
  NormalizedStatus,
} from "./types";
import { tripayBase, appBaseUrl } from "./config";
import { cfg } from "@/lib/settings-store";

function mapStatus(status: string): NormalizedStatus {
  switch ((status || "").toUpperCase()) {
    case "PAID":
      return "PAID";
    case "EXPIRED":
      return "EXPIRED";
    case "FAILED":
    case "REFUND":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Tripay closed-payment (QRIS / VA / e-wallet) integration. */
export class TripayProvider implements PaymentProvider {
  name = "tripay";

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const apiKey = cfg("TRIPAY_API_KEY") ?? "";
    const privateKey = cfg("TRIPAY_PRIVATE_KEY") ?? "";
    const merchantCode = cfg("TRIPAY_MERCHANT_CODE") ?? "";
    const method = cfg("TRIPAY_PAYMENT_METHOD") ?? "QRIS";

    const signature = crypto
      .createHmac("sha256", privateKey)
      .update(merchantCode + input.merchantRef + input.amount)
      .digest("hex");

    const res = await fetch(`${tripayBase()}/transaction/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        merchant_ref: input.merchantRef,
        amount: input.amount,
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone ?? undefined,
        order_items: [
          { name: input.itemName, price: input.amount, quantity: 1 },
        ],
        callback_url: `${appBaseUrl()}/api/webhook/tripay`,
        return_url: `${appBaseUrl()}/dashboard`,
        signature,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      throw new Error(
        `Tripay createCharge failed: ${res.status} ${JSON.stringify(json)}`,
      );
    }

    const d = json.data ?? {};
    return {
      ref: d.reference,
      instantPaid: false,
      redirectUrl: d.checkout_url ?? null,
      qrString: d.qr_string ?? null,
      qrImageUrl: d.qr_url ?? null,
      payCode: d.pay_code ?? null,
      raw: json,
    };
  }

  async parseWebhook(req: { headers: Headers; rawBody: string }): Promise<WebhookResult> {
    const privateKey = cfg("TRIPAY_PRIVATE_KEY") ?? "";
    const sig = req.headers.get("x-callback-signature") ?? "";
    const expected = crypto
      .createHmac("sha256", privateKey)
      .update(req.rawBody)
      .digest("hex");

    if (!sig || !timingSafeEqual(expected, sig)) {
      return { ok: false, httpStatus: 403, responseBody: { success: false } };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, httpStatus: 400, responseBody: { success: false } };
    }

    return {
      ok: true,
      merchantRef: String(body.merchant_ref ?? ""),
      gatewayRef: String(body.reference ?? ""),
      status: mapStatus(String(body.status ?? "")),
      amount: Number(body.total_amount ?? body.amount ?? 0),
      httpStatus: 200,
      responseBody: { success: true },
    };
  }
}
