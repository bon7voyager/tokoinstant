"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { refreshSettings } from "@/lib/settings-store";
import { saveUploadedImage, imageErrorMessage } from "@/lib/upload";

export type SettingsState = { error?: string; success?: string } | undefined;

// Secrets are write-only in the UI: an empty submission keeps the stored value.
const SECRET_KEYS = ["MIDTRANS_SERVER_KEY", "TRIPAY_API_KEY", "TRIPAY_PRIVATE_KEY", "PAKASIR_API_KEY"];
// Booleans are always written (so unchecking takes effect).
const BOOL_KEYS = ["MIDTRANS_IS_PRODUCTION", "TRIPAY_IS_PRODUCTION", "PAKASIR_QRIS_ONLY"];
// Plain text/number: empty clears the override (falls back to env/default).
const TEXT_KEYS = [
  "PAYMENT_PROVIDER",
  "MIDTRANS_CLIENT_KEY",
  "TRIPAY_MERCHANT_CODE",
  "TRIPAY_PAYMENT_METHOD",
  "PAKASIR_PROJECT",
  "APP_BASE_URL",
  // Reseller config (PREMIUM_FEE/PREMIUM_DAYS/RESELLER_DISCOUNT_PERCENT) lives in the
  // /admin/membership hub now — kept out of here so saving general settings (which
  // no longer posts those fields) doesn't clear them.
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

async function setKey(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function delKey(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}

export async function updateSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const provider = String(formData.get("PAYMENT_PROVIDER") ?? "").trim().toLowerCase();
  if (provider && !["simulation", "midtrans", "tripay", "pakasir"].includes(provider)) {
    return { error: "Provider pembayaran tidak valid." };
  }

  // An uploaded banner image wins over the pasted URL.
  let bannerImageOverride: string | null = null;
  const bannerFile = formData.get("BANNER_IMAGE_FILE");
  if (bannerFile instanceof File && bannerFile.size > 0) {
    try {
      bannerImageOverride = await saveUploadedImage(bannerFile, "banner");
    } catch (e) {
      return { error: imageErrorMessage(e) };
    }
  }

  try {
    for (const key of BOOL_KEYS) {
      await setKey(key, formData.get(key) === "true" ? "true" : "false");
    }
    for (const key of SECRET_KEYS) {
      const v = String(formData.get(key) ?? "").trim();
      if (v) await setKey(key, v); // empty -> keep the stored secret
    }
    for (const key of TEXT_KEYS) {
      if (key === "BANNER_IMAGE_URL" && bannerImageOverride) {
        await setKey(key, bannerImageOverride); // uploaded file overrides the URL field
        continue;
      }
      const v = String(formData.get(key) ?? "").trim();
      if (v) await setKey(key, v);
      else await delKey(key); // cleared -> fall back to env/default
    }
  } catch (e) {
    console.error("[settings] save failed", e);
    return { error: "Gagal menyimpan pengaturan. Coba lagi." };
  }

  await refreshSettings();
  revalidatePath("/admin/settings");
  return { success: "Pengaturan tersimpan & langsung aktif." };
}
