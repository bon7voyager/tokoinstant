"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhoneID } from "@/lib/notify/phone";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/rate-limit";

export type ProfileState = { error?: string; success?: string } | undefined;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
});

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi habis. Silakan login ulang." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhoneID(phoneRaw);
    if (!phone) {
      return { error: "Nomor WhatsApp tidak valid (contoh: 0812xxxx)." };
    }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, email: parsed.data.email, phone },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "Email itu sudah dipakai akun lain." };
    }
    throw e;
  }

  revalidatePath("/dashboard");
  return { success: "Profil berhasil diperbarui." };
}

/**
 * Change the logged-in user's password. Accounts that already have a password must
 * confirm the current one; Google-only accounts (no password yet) can set one
 * without it, so they can also log in manually afterwards.
 */
export async function changePasswordAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi habis. Silakan login ulang." };

  // Bot gate (Cloudflare Turnstile) before touching the password.
  const captchaOk = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    await clientIp(),
  );
  if (!captchaOk) return { error: "Verifikasi captcha gagal. Coba lagi." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "Password baru minimal 6 karakter." };
  if (next !== confirm) return { error: "Konfirmasi password tidak cocok." };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "Akun tidak ditemukan." };

  if (dbUser.password) {
    if (!current) return { error: "Masukkan password saat ini." };
    if (!(await verifyPassword(current, dbUser.password))) {
      return { error: "Password saat ini salah." };
    }
    if (current === next) return { error: "Password baru harus beda dari yang lama." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(next) },
  });

  return { success: dbUser.password ? "Password berhasil diganti." : "Password berhasil dibuat." };
}
