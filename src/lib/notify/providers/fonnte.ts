import type { WhatsAppProvider, DispatchResult } from "../types";

const TIMEOUT_MS = 10_000;

export class FonnteProvider implements WhatsAppProvider {
  name = "fonnte";

  async send(args: { to: string; message: string }): Promise<DispatchResult> {
    const form = new URLSearchParams();
    form.set("target", args.to); // 62xxxx
    form.set("message", args.message);
    form.set("countryCode", process.env.FONNTE_COUNTRY_CODE ?? "62");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          // Fonnte sends the token RAW (no "Bearer " prefix).
          Authorization: process.env.FONNTE_TOKEN!,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      // Fonnte can return HTTP 200 with status:false on logical failure.
      const ok = res.ok && json?.status;
      return ok
        ? {
            ok: true,
            provider: "fonnte",
            providerRef: Array.isArray(json.id) ? json.id[0] : (json.id ?? null),
          }
        : {
            ok: false,
            provider: "fonnte",
            error: json?.reason ?? `HTTP ${res.status}`,
          };
    } catch (e) {
      return {
        ok: false,
        provider: "fonnte",
        error: e instanceof Error ? e.message : "request_failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
