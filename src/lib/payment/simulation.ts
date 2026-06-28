import type { PaymentProvider, CreateChargeInput, ChargeResult, WebhookResult } from "./types";

/** Instant-success provider used for local dev / when no gateway is configured. */
export class SimulationProvider implements PaymentProvider {
  name = "simulation";

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    return {
      ref: `SIM-${input.purpose}-${Date.now()}`,
      instantPaid: true,
    };
  }

  async parseWebhook(): Promise<WebhookResult> {
    // Simulation never receives real webhooks.
    return { ok: false, httpStatus: 400, responseBody: { error: "no webhook in simulation mode" } };
  }
}
