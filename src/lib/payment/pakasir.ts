import type {
  PaymentProvider,
  CreateChargeInput,
  ChargeResult,
  WebhookResult,
  NormalizedStatus,
} from "./types";
import { pakasirBase, appBaseUrl } from "./config";
import { cfg } from "@/lib/settings-store";

function mapStatus(status: string): NormalizedStatus {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "PAID";
    case "expired":
      return "EXPIRED";
    case "failed":
    case "canceled":
    case "cancelled":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/**
 * Pakasir (app.pakasir.com) — Indonesian "link pembayaran" (QRIS / Virtual Account).
 *
 * Flow: we send the buyer to Pakasir's HOSTED pay page (so we never render a QR
 * ourselves), and Pakasir creates the transaction keyed by our `order_id`.
 *
 * SECURITY: Pakasir webhooks are NOT signed. So `parseWebhook` re-verifies every
 * callback by querying Pakasir's `transactiondetail` API and only reports PAID when
 * Pakasir itself confirms the transaction is completed — a forged POST to our
 * webhook URL can never settle an order.
 */
export class PakasirProvider implements PaymentProvider {
  name = "pakasir";

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const project = cfg("PAKASIR_PROJECT") ?? "";
    const qrisOnly = cfg("PAKASIR_QRIS_ONLY") === "true";
    const returnUrl = `${appBaseUrl()}/dashboard`;

    // Hosted payment link — Pakasir creates the transaction when the buyer lands.
    const url =
      `${pakasirBase()}/pay/${encodeURIComponent(project)}/${input.amount}` +
      `?order_id=${encodeURIComponent(input.merchantRef)}` +
      `&redirect=${encodeURIComponent(returnUrl)}` +
      (qrisOnly ? "&qris_only=1" : "");

    return {
      ref: input.merchantRef, // Pakasir keys transactions by order_id
      instantPaid: false,
      redirectUrl: url,
      qrString: null,
      qrImageUrl: null,
      payCode: null,
      raw: null,
    };
  }

  async parseWebhook(req: { headers: Headers; rawBody: string }): Promise<WebhookResult> {
    const apiKey = cfg("PAKASIR_API_KEY") ?? "";
    const project = cfg("PAKASIR_PROJECT") ?? "";

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, httpStatus: 400, responseBody: { received: false } };
    }

    const orderId = String(body.order_id ?? "");
    const bodyProject = String(body.project ?? "");
    const bodyAmount = Number(body.amount ?? 0);

    // Cheap spoof guard: ignore callbacks for a different project.
    if (!orderId || !bodyProject || bodyProject !== project) {
      return { ok: false, httpStatus: 200, responseBody: { received: true } };
    }

    // Webhook is UNSIGNED → re-verify with Pakasir before trusting it.
    let verified: { status: string; amount: number } | null = null;
    try {
      const url =
        `${pakasirBase()}/api/transactiondetail` +
        `?project=${encodeURIComponent(project)}` +
        `&amount=${bodyAmount}` +
        `&order_id=${encodeURIComponent(orderId)}` +
        `&api_key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { transaction?: Record<string, unknown> };
        const t = json.transaction ?? {};
        verified = { status: String(t.status ?? ""), amount: Number(t.amount ?? NaN) };
      }
    } catch (e) {
      console.error("[pakasir] transactiondetail verify failed", e);
    }

    // Could not reach Pakasir to verify → ask it to retry the callback (5xx).
    if (verified === null) {
      return { ok: false, httpStatus: 500, responseBody: { received: false } };
    }

    // Not confirmed paid → acknowledge but do NOT settle.
    if (mapStatus(verified.status) !== "PAID") {
      return { ok: false, httpStatus: 200, responseBody: { received: true } };
    }

    return {
      ok: true,
      merchantRef: orderId,
      gatewayRef: orderId,
      status: "PAID",
      amount: Number.isFinite(verified.amount) ? verified.amount : bodyAmount,
      httpStatus: 200,
      responseBody: { received: true },
    };
  }
}
