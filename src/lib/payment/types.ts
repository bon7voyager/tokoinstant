export type PaymentPurpose = "ORDER" | "TOPUP" | "MEMBERSHIP";

export type NormalizedStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface CreateChargeInput {
  purpose: PaymentPurpose;
  merchantRef: string; // our unique ref (orderNumber for ORDER, "TOP-<id>" for TOPUP)
  amount: number; // IDR
  customer: { name: string; email: string; phone?: string | null };
  itemName: string;
}

export interface ChargeResult {
  ref: string; // gateway reference (or "SIM-...")
  instantPaid: boolean; // simulation -> true; real gateway -> false
  redirectUrl?: string | null;
  qrString?: string | null;
  qrImageUrl?: string | null;
  payCode?: string | null;
  raw?: unknown;
}

export interface WebhookResult {
  ok: boolean; // signature valid + parsed
  merchantRef?: string;
  gatewayRef?: string;
  status?: NormalizedStatus;
  amount?: number;
  httpStatus: number;
  responseBody: unknown;
}

export interface PaymentProvider {
  name: string;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Verify signature + parse a raw webhook. MUST NOT touch the DB. */
  parseWebhook(req: { headers: Headers; rawBody: string }): Promise<WebhookResult>;
}
