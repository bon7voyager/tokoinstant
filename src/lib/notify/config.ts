import type { EmailProvider, WhatsAppProvider } from "./types";
import { ResendProvider } from "./providers/resend";
import { SmtpProvider } from "./providers/smtp";
import { FonnteProvider } from "./providers/fonnte";

export function notifyEnabled(): boolean {
  return process.env.NOTIFY_ENABLED !== "false";
}

export function logBodyMode(): "full" | "redacted" {
  // Fail-safe: redact stored credentials unless an operator explicitly opts out.
  return process.env.NOTIFY_LOG_BODY === "full" ? "full" : "redacted";
}

export function resolveEmailProvider(): EmailProvider | null {
  const explicit = process.env.NOTIFY_EMAIL_PROVIDER?.toLowerCase();
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSmtp = !!process.env.SMTP_HOST;

  if (explicit === "resend" || (!explicit && hasResend)) {
    return hasResend ? new ResendProvider() : null;
  }
  if (explicit === "smtp" || (!explicit && hasSmtp)) {
    return hasSmtp ? new SmtpProvider() : null;
  }
  return null;
}

export function resolveWhatsAppProvider(): WhatsAppProvider | null {
  const explicit = process.env.NOTIFY_WA_PROVIDER?.toLowerCase();
  const hasFonnte = !!process.env.FONNTE_TOKEN;
  if (explicit === "fonnte" || (!explicit && hasFonnte)) {
    return hasFonnte ? new FonnteProvider() : null;
  }
  return null;
}

/** Snapshot of which channels are live, for the admin badge. */
export function notifyStatus() {
  return {
    enabled: notifyEnabled(),
    email: resolveEmailProvider()?.name ?? null,
    whatsapp: resolveWhatsAppProvider()?.name ?? null,
    logBody: logBodyMode(),
  };
}
