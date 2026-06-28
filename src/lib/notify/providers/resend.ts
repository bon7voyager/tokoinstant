import type { EmailProvider, DispatchResult } from "../types";

const TIMEOUT_MS = 10_000;

export class ResendProvider implements EmailProvider {
  name = "resend";

  async send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<DispatchResult> {
    const from = process.env.RESEND_FROM ?? process.env.EMAIL_FROM;
    if (!from) {
      return { ok: false, provider: "resend", error: "missing RESEND_FROM" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      return res.ok
        ? { ok: true, provider: "resend", providerRef: json.id ?? null }
        : { ok: false, provider: "resend", error: json?.message ?? `HTTP ${res.status}` };
    } catch (e) {
      return {
        ok: false,
        provider: "resend",
        error: e instanceof Error ? e.message : "request_failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
