"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPremium } from "@/lib/membership";
import { generateApiKey } from "@/lib/api-key";
import { callbackUrlError } from "@/lib/ssrf";

export type ApiKeyState =
  | { error?: string; success?: string; fullKey?: string }
  | undefined;

/** Only active resellers may manage API credentials. */
async function requireResellerUser() {
  const user = await getCurrentUser();
  if (!user) return { error: "Silakan login dulu." as const };
  if (!isPremium(user)) {
    return { error: "Fitur API hanya untuk member reseller aktif." as const };
  }
  return { user };
}

export async function createApiKeyAction(
  _prev: ApiKeyState,
  formData: FormData,
): Promise<ApiKeyState> {
  const r = await requireResellerUser();
  if ("error" in r) return { error: r.error };

  const label = String(formData.get("label") ?? "").trim() || "API Key";
  if (label.length > 40) return { error: "Label maksimal 40 karakter." };

  const activeCount = await prisma.apiKey.count({
    where: { userId: r.user.id, revokedAt: null },
  });
  if (activeCount >= 5) {
    return { error: "Maksimal 5 API key aktif. Cabut yang lama dulu." };
  }

  const { full, prefix, hash } = generateApiKey();
  await prisma.apiKey.create({
    data: { userId: r.user.id, label, prefix, keyHash: hash },
  });

  revalidatePath("/dashboard/api");
  return {
    success: "API key dibuat. Salin sekarang — kunci penuh tidak akan ditampilkan lagi.",
    fullKey: full,
  };
}

export async function revokeApiKeyAction(formData: FormData) {
  const r = await requireResellerUser();
  if ("error" in r) return;
  const id = String(formData.get("id") ?? "");
  await prisma.apiKey.updateMany({
    where: { id, userId: r.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/dashboard/api");
}

export async function saveCallbackAction(
  _prev: ApiKeyState,
  formData: FormData,
): Promise<ApiKeyState> {
  const r = await requireResellerUser();
  if ("error" in r) return { error: r.error };

  const url = String(formData.get("apiCallbackUrl") ?? "").trim();
  if (url) {
    const err = await callbackUrlError(url);
    if (err) return { error: err };
  }

  // Make sure a signing secret exists (created once, reused).
  const existing = await prisma.user.findUnique({
    where: { id: r.user.id },
    select: { apiCallbackSecret: true },
  });
  const secret = existing?.apiCallbackSecret ?? randomBytes(24).toString("base64url");

  await prisma.user.update({
    where: { id: r.user.id },
    data: { apiCallbackUrl: url || null, apiCallbackSecret: secret },
  });
  revalidatePath("/dashboard/api");
  return { success: url ? "URL webhook tersimpan." : "URL webhook dihapus." };
}
