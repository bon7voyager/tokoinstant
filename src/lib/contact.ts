import "server-only";
import { cfg } from "@/lib/settings-store";

const digits = (s: string | undefined) => (s ?? "").replace(/[^0-9]/g, "");
const handle = (s: string | undefined, host: RegExp) =>
  (s ?? "").trim().replace(/^@/, "").replace(host, "").replace(/\/+$/, "");

/**
 * Admin contact details, resolved from settings (DB > env > sensible default).
 * Empty fields are simply hidden by the UI.
 */
export function contactInfo() {
  const wa = digits(cfg("CONTACT_WHATSAPP"));
  const ig = handle(cfg("CONTACT_INSTAGRAM"), /^https?:\/\/(www\.)?instagram\.com\//i);
  const tg = handle(cfg("CONTACT_TELEGRAM"), /^https?:\/\/(t\.me|telegram\.me)\//i);

  return {
    whatsapp: wa,
    waLink: wa ? `https://wa.me/${wa}` : "",
    waDisplay: wa ? `+${wa}` : "",
    email: (cfg("CONTACT_EMAIL") ?? "admin@kilat.shop").trim(),
    instagram: ig,
    igLink: ig ? `https://instagram.com/${ig}` : "",
    telegram: tg,
    tgLink: tg ? `https://t.me/${tg}` : "",
    hours: (cfg("CONTACT_HOURS") ?? "Setiap hari · 08.00–22.00 WIB").trim(),
  };
}

/** WhatsApp deep link with an optional prefilled message. Empty if no number set. */
export function waLinkWith(message?: string) {
  const wa = digits(cfg("CONTACT_WHATSAPP"));
  if (!wa) return "";
  return `https://wa.me/${wa}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
