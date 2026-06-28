import { cfg, ensureSettings } from "@/lib/settings-store";
import { paymentStatus } from "@/lib/payment";
import { Badge } from "@/components/ui";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

// Non-secret keys shown pre-filled with their current effective value (DB > env).
const TEXT_KEYS = [
  "PAYMENT_PROVIDER",
  "APP_BASE_URL",
  "MIDTRANS_CLIENT_KEY",
  "MIDTRANS_IS_PRODUCTION",
  "TRIPAY_MERCHANT_CODE",
  "TRIPAY_PAYMENT_METHOD",
  "TRIPAY_IS_PRODUCTION",
  "PAKASIR_PROJECT",
  "PAKASIR_QRIS_ONLY",
  "TOPUP_MIN",
  "TOPUP_MAX",
  "TOPUP_PRESETS",
  "WITHDRAW_MIN",
  "ORDER_EXPIRY_MINUTES",
  "REFERRAL_REFERRER_BONUS",
  "REFERRAL_REFEREE_BONUS",
  "REFERRAL_MIN_ORDER",
  "REFERRAL_REFERRER_REQUIRE_PURCHASE",
  "REFERRAL_MAX_PER_PERIOD",
  "REFERRAL_PERIOD_DAYS",
  "REFERRAL_BLOCK_SAME_IP",
  "BANNER_ENABLED",
  "BANNER_TITLE",
  "BANNER_BODY",
  "BANNER_IMAGE_URL",
  "BANNER_CTA_LABEL",
  "BANNER_CTA_URL",
  "CONTACT_WHATSAPP",
  "CONTACT_EMAIL",
  "CONTACT_INSTAGRAM",
  "CONTACT_TELEGRAM",
  "CONTACT_HOURS",
];
const SECRET_KEYS = ["MIDTRANS_SERVER_KEY", "TRIPAY_API_KEY", "TRIPAY_PRIVATE_KEY", "PAKASIR_API_KEY"];

export default async function AdminSettingsPage() {
  // Guarantee the settings cache is populated before reading cfg() — otherwise a
  // cold cache (right after a restart) would render the form with empty fields,
  // and saving would wipe stored settings.
  await ensureSettings();

  const initial: Record<string, string> = {};
  for (const k of TEXT_KEYS) initial[k] = cfg(k) ?? "";
  const secretSet: Record<string, boolean> = {};
  for (const k of SECRET_KEYS) secretSet[k] = !!cfg(k);

  const status = paymentStatus();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Pengaturan</h1>
          <p className="font-medium text-ink/60">
            Atur API pembayaran, saldo & pesanan langsung dari sini. Konfigurasi
            reseller ada di menu Reseller.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase text-ink/60">Provider aktif:</span>
          <Badge variant={status.active === "simulation" ? "white" : "lime"}>
            {status.active}
          </Badge>
          {status.degraded && <Badge variant="secondary">fallback simulasi</Badge>}
        </div>
      </div>

      {status.degraded && (
        <div className="mt-4 border-3 border-ink bg-main p-3 text-sm font-bold shadow-brutal-sm">
          ⚠️ Provider <b>{status.configured}</b> dipilih tapi key-nya belum lengkap, jadi
          sementara memakai mode simulasi. Lengkapi key di bawah untuk mengaktifkannya.
        </div>
      )}

      <div className="mt-6">
        <SettingsForm initial={initial} secretSet={secretSet} />
      </div>
    </div>
  );
}
