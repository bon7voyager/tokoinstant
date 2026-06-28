import "server-only";

// Cloudflare's documented "always passes" test key — used as the client fallback
// so the widget renders out of the box in dev. Real enforcement only kicks in
// once BOTH real keys are set (see turnstileConfigured).
const TEST_SITE_KEY = "1x00000000000000000000AA";

const siteSet = () => !!process.env.TURNSTILE_SITE_KEY;
const secretSet = () => !!process.env.TURNSTILE_SECRET_KEY;

/**
 * Public site key for the client widget. Falls back to Cloudflare's always-pass
 * test key ONLY when captcha is entirely unconfigured — never when a secret is
 * set, so a half-configured deploy doesn't render a fake "working" captcha.
 */
export function turnstileSiteKey(): string {
  if (siteSet()) return process.env.TURNSTILE_SITE_KEY!;
  if (secretSet()) return ""; // partial config — render nothing rather than a fake widget
  return TEST_SITE_KEY;
}

/** Captcha is fully configured only when both keys are set. */
export function turnstileConfigured(): boolean {
  return siteSet() && secretSet();
}

/**
 * Verify a Turnstile token with Cloudflare.
 * - Fully unconfigured (no keys) → no-op (true) so the store works without setup.
 * - Both keys set → real verification (fail-closed).
 * - Exactly one key set → fail-closed + warn, so a misconfiguration can't silently
 *   disable the captcha while appearing enabled.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!siteSet() && !secretSet()) return true; // intentional dev no-op
  if (!turnstileConfigured()) {
    console.warn(
      "[turnstile] Only one of TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY is set — " +
        "captcha is misconfigured and will reject requests until both are provided.",
    );
    return false;
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", process.env.TURNSTILE_SECRET_KEY!);
    body.set("response", token);
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
