"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  randomOtp,
} from "@/lib/auth";
import { normalizePhoneID } from "@/lib/notify/phone";
import { notifyEmailVerification } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { attachReferralFromCookie } from "@/lib/referral";
import { verifyOtp, OTP_TTL_MIN } from "@/lib/otp";

export type AuthState =
  | { error?: string; step?: "verify"; email?: string; resent?: boolean }
  | undefined;

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z.string().trim().optional(),
});

/**
 * Step 1 of registration: validate the details, stash the would-be account
 * (with a hashed password + hashed 6-digit OTP) in EmailVerification, and email
 * the code. The real User is NOT created until the code is verified.
 */
export async function startRegistrationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.toLowerCase().trim();
  const ip = await clientIp();

  // Bot gate (Cloudflare Turnstile) before doing any work or sending email.
  const captchaOk = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    ip,
  );
  if (!captchaOk) return { error: "Verifikasi captcha gagal. Coba lagi." };

  // Throttle the (unauthenticated, email-sending) endpoint per IP and per email
  // so it can't be used to flood inboxes or burn the email-provider quota.
  if (
    !rateLimit(`reg:ip:${ip}`, 8, 10 * 60_000) ||
    !rateLimit(`reg:email:${email}`, 4, 10 * 60_000)
  ) {
    return { error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." };
  }

  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizePhoneID(parsed.data.phone);
    if (!phone) return { error: "Nomor WhatsApp tidak valid (contoh: 0812xxxx)." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terdaftar. Coba login." };

  const code = randomOtp();
  const data = {
    kind: "register",
    name: parsed.data.name.trim(),
    passwordHash: await hashPassword(parsed.data.password),
    phone,
    codeHash: await hashPassword(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
    attempts: 0,
  };
  await prisma.emailVerification.upsert({
    where: { email },
    create: { email, ...data },
    update: data,
  });

  await notifyEmailVerification({ email, code, minutes: OTP_TTL_MIN });
  return { step: "verify", email };
}

/** Step 2: verify the OTP, create the real account, and sign in. */
export async function verifyRegistrationAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyOtp(email, code, "register");
  if (!result.ok) return result.state;
  const pending = result.pending;

  // Code valid — create the account (guard against a race on the unique email).
  const dupe = await prisma.user.findUnique({ where: { email } });
  if (dupe) {
    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
    return { error: "Email sudah terdaftar. Coba login." };
  }

  const signupIp = await clientIp();
  const user = await prisma.user
    .create({
      data: {
        name: pending.name,
        email,
        phone: pending.phone,
        password: pending.passwordHash,
        role: "USER",
        signupIp: signupIp === "unknown" ? null : signupIp,
      },
    })
    .catch(() => null);
  if (!user) return { error: "Gagal membuat akun. Coba lagi sebentar." };

  await attachReferralFromCookie(user.id);
  await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
  await createSession(user.id, user.role);
  redirect("/dashboard");
}

/** Resend a fresh code for an in-progress registration. */
export async function resendRegistrationCodeAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();

  // Cooldown so resend can't be used to flood the inbox or reset the attempt cap
  // in a tight loop.
  if (!rateLimit(`resend:email:${email}`, 3, 10 * 60_000)) {
    return { step: "verify", email, error: "Terlalu sering minta kode. Tunggu sebentar." };
  }

  const code = randomOtp();
  // updateMany (not update) so a row deleted by a concurrent verify doesn't throw.
  const res = await prisma.emailVerification.updateMany({
    where: { email },
    data: {
      codeHash: await hashPassword(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
      attempts: 0,
    },
  });
  if (res.count === 0) {
    return { error: "Sesi verifikasi tidak ditemukan. Silakan daftar ulang." };
  }
  await notifyEmailVerification({ email, code, minutes: OTP_TTL_MIN });
  return { step: "verify", email, resent: true };
}

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Bot gate (Cloudflare Turnstile) before checking credentials.
  const captchaOk = await verifyTurnstile(
    String(formData.get("cf-turnstile-response") ?? ""),
    await clientIp(),
  );
  if (!captchaOk) return { error: "Verifikasi captcha gagal. Coba lagi." };

  // Email-only login (email is unique).
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.password) {
    return { error: "Akun ini dibuat dengan Google. Silakan masuk pakai tombol Google." };
  }
  if (!user || !user.password || !(await verifyPassword(parsed.data.password, user.password))) {
    return { error: "Email atau password salah." };
  }

  await createSession(user.id, user.role);

  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
