import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreateChargeInput,
  ChargeResult,
  WebhookResult,
  NormalizedStatus,
} from "./types";
import { midtransBase, appBaseUrl } from "./config";
import { cfg } from "@/lib/settings-store";

function mapStatus(transaction_status: string, fraud_status?: string): NormalizedStatus {
  switch (transaction_status) {
    case "capture":
      return fraud_status === "challenge" ? "PENDING" : "PAID";
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    case "expire":
      return "EXPIRED";
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

/** Midtrans Snap integration. */
export class MidtransProvider implements PaymentProvider {
  name = "midtrans";

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const serverKey = cfg("MIDTRANS_SERVER_KEY") ?? "";
    const auth = Buffer.from(`${serverKey}:`).toString("base64");

    const res = await fetch(`${midtransBase()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: input.merchantRef,
          gross_amount: input.amount,
        },
        item_details: [
          {
            id: input.purpose,
            name: input.itemName.slice(0, 50),
            price: input.amount,
            quantity: 1,
          },
        ],
        customer_details: {
          first_name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone ?? undefined,
        },
        callbacks: { finish: `${appBaseUrl()}/dashboard` },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `Midtrans createCharge failed: ${res.status} ${JSON.stringify(json)}`,
      );
    }

    return {
      ref: input.merchantRef,
      instantPaid: false,
      redirectUrl: json.redirect_url ?? null,
      raw: json,
    };
  }

  async parseWebhook(req: { headers: Headers; rawBody: string }): Promise<WebhookResult> {
    let body: Record<string, string>;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, httpStatus: 400, responseBody: { error: "bad json" } };
    }

    const serverKey = cfg("MIDTRANS_SERVER_KEY") ?? "";
    const expected = crypto
      .createHash("sha512")
      .update(body.order_id + body.status_code + body.gross_amount + serverKey)
      .digest("hex");

    if (!body.signature_key || !timingSafeEqual(expected, body.signature_key)) {
      return { ok: false, httpStatus: 403, responseBody: { error: "bad signature" } };
    }

    return {
      ok: true,
      merchantRef: body.order_id,
      gatewayRef: body.transaction_id,
      status: mapStatus(body.transaction_status, body.fraud_status),
      amount: Number(body.gross_amount),
      httpStatus: 200,
      responseBody: { received: true },
    };
  }
}
