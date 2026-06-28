import "server-only";
import crypto from "crypto";
import { cfg } from "@/lib/settings-store";

/** Only allow http(s) absolute URLs or internal "/paths" — blocks javascript:/data: etc. */
function safeUrl(v: string | undefined): string {
  // Strip interior control chars (tab/newline/CR) too — browsers strip them during
  // href resolution, so "/\t/evil.com" would otherwise sneak past as "//evil.com".
  const s = (v ?? "").replace(/[\x00-\x1f]/g, "").trim();
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s; // internal path
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : "";
  } catch {
    return "";
  }
}

export type BannerData = {
  active: boolean;
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  version: string; // changes whenever content changes -> popup re-shows after edits
};

/**
 * Dashboard promo/announcement banner (admin setting > env > default). Content is
 * plain text (rendered without HTML) so it can't inject markup. The version hash
 * lets the client re-show the popup automatically whenever the admin edits it.
 */
export function bannerConfig(): BannerData {
  const enabled = (cfg("BANNER_ENABLED") ?? "0") === "1";
  const title = (cfg("BANNER_TITLE") ?? "").trim();
  const body = (cfg("BANNER_BODY") ?? "").trim();
  const imageUrl = safeUrl(cfg("BANNER_IMAGE_URL"));
  const ctaLabel = (cfg("BANNER_CTA_LABEL") ?? "").trim();
  const ctaUrl = safeUrl(cfg("BANNER_CTA_URL"));
  // Only show a CTA button when BOTH a label and a valid URL exist.
  const cta = ctaLabel && ctaUrl ? { ctaLabel, ctaUrl } : { ctaLabel: "", ctaUrl: "" };

  const active = enabled && (!!title || !!body || !!imageUrl);
  // JSON.stringify keeps field boundaries unambiguous (no cross-field hash collision).
  const version = active
    ? crypto
        .createHash("sha1")
        .update(JSON.stringify([title, body, imageUrl, cta.ctaLabel, cta.ctaUrl]))
        .digest("hex")
        .slice(0, 12)
    : "";

  return { active, title, body, imageUrl, ...cta, version };
}
