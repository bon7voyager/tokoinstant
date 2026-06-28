"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, randomOtp } from "@/lib/auth";
import { notifyPasswordReset } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyOtp, OTP_TTL_MIN } from "@/lib/otp";

/**
 * Flow state for the 3-step reset:
 *   "code"  → show the OTP-entry form
 *   "reset" → code already validated; show the new-password form (code carried hidden)
 */
export type ResetState =
  | { error?: string; step?: "code" | "reset"; email?: string; code?: string; resent?: boolean }
  | undefined;

/**
 * Step 1 — ask for a reset code. ANTI-ENUMERATION: always advances to the code step
 * with the same response, whether or not the email has an account. A real code is
 * only generated/sent when the account exists AND has a password.
 */
export async function requestPasswordResetAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Email tidak valid." };
  }
  const ip = await clientIp();

  const captchaOk = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
  );
  if (!captchaOk) return { error: "Verifikasi captcha gagal. Coba lagi." };

  if (
    !rateLimit(`reset:ip:${ip}`, 8, 10 * 60_000) ||
    !rateLimit(`reset:email:${email}`, 4, 10 * 60_000)
  ) {
    return { error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.password) {
    const code = randomOtp();
    const data = {
      kind: "reset",
      name: user.name,
      passwordHash: null,
      phone: null,
      codeHash: await hashPassword(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
      attempts: 0,
    };
    await prisma.emailVerification.upsert({
      where: { email },
      create: { email, ...data },
      update: data,
    });
    await notifyPasswordReset({ email, code, minutes: OTP_TTL_MIN });
  }

  return { step: "code", email };
}

/**
 * Step 2 — validate the code only (does NOT consume it). On success we reveal the
 * new-password form; the code is carried (hidden) into step 3 and re-checked there.
 */
export async function verifyResetCodeAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyOtp(email, code, "reset");
  if (!result.ok) {
    return { step: "code", email, error: result.state.error };
  }
  // Valid — advance to the password form (verifyOtp does not delete on success).
  return { step: "reset", email, code };
}

/** Step 3 — re-verify the (carried) code and set the new password, then sign in. */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { step: "reset", email, code, error: "Password minimal 6 karakter." };
  }
  if (password !== confirm) {
    return { step: "reset", email, code, error: "Konfirmasi password tidak cocok." };
  }

  const result = await verifyOtp(email, code, "reset");
  if (!result.ok) {
    // Code expired/invalid between steps → send back to the code step.
    return { step: "code", email, error: result.state.error };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
    return { error: "Akun tidak ditemukan. Silakan ulang dari awal." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(password) },
  });
  await prisma.emailVerification.delete({ where: { email } }).catch(() => {});

  await createSession(user.id, user.role);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

/** Resend a fresh reset code. Generic (no enumeration): only emails when a reset
 * session actually exists for this address. Returns the user to the code step. */
export async function resendPasswordResetCodeAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();

  if (!rateLimit(`reset-resend:email:${email}`, 3, 10 * 60_000)) {
    return { step: "code", email, error: "Terlalu sering minta kode. Tunggu sebentar." };
  }

  const existing = await prisma.emailVerification.findFirst({
    where: { email, kind: "reset" },
  });
  if (existing) {
    const code = randomOtp();
    await prisma.emailVerification.updateMany({
      where: { email, kind: "reset" },
      data: {
        codeHash: await hashPassword(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
        attempts: 0,
      },
    });
    await notifyPasswordReset({ email, code, minutes: OTP_TTL_MIN });
  }

  return { step: "code", email, resent: true };
}
