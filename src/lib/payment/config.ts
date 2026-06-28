import { cfg } from "@/lib/settings-store";

export type ProviderName = "simulation" | "midtrans" | "tripay" | "pakasir";

export function configuredProvider(): ProviderName {
  const p = (cfg("PAYMENT_PROVIDER") ?? "simulation").toLowerCase();
  if (p === "midtrans" || p === "tripay" || p === "pakasir" || p === "simulation") return p;
  return "simulation";
}

export function midtransReady() {
  return !!cfg("MIDTRANS_SERVER_KEY");
}

export function tripayReady() {
  return !!(cfg("TRIPAY_API_KEY") && cfg("TRIPAY_PRIVATE_KEY") && cfg("TRIPAY_MERCHANT_CODE"));
}

export function pakasirReady() {
  return !!(cfg("PAKASIR_API_KEY") && cfg("PAKASIR_PROJECT"));
}

/** The provider actually used, falling back to simulation if keys are missing. */
export function activeProvider(): ProviderName {
  const p = configuredProvider();
  if (p === "midtrans" && !midtransReady()) return "simulation";
  if (p === "tripay" && !tripayReady()) return "simulation";
  if (p === "pakasir" && !pakasirReady()) return "simulation";
  return p;
}

export function paymentStatus() {
  const configured = configuredProvider();
  const active = activeProvider();
  return { configured, active, degraded: configured !== active };
}

export function appBaseUrl() {
  return (
    cfg("APP_BASE_URL") ??
    cfg("NEXT_PUBLIC_SITE_URL") ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function midtransBase() {
  return cfg("MIDTRANS_IS_PRODUCTION") === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export function tripayBase() {
  return cfg("TRIPAY_IS_PRODUCTION") === "true"
    ? "https://tripay.co.id/api"
    : "https://tripay.co.id/api-sandbox";
}

export function pakasirBase() {
  // Pakasir uses a single host; sandbox is a per-project mode, not a separate domain.
  return "https://app.pakasir.com";
}
