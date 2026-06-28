import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpFailure = { error?: string; step?: "verify"; email?: string };
export type OtpPending = {
  email: string;
  name: string;
  phone: string | null;
  passwordHash: string | null;
};

export type OtpResult =
  | { ok: true; pending: OtpPending }
  | { ok: false; state: OtpFailure };

/**
 * Shared, race-safe OTP check used by both registration and guest checkout. Lives
 * in a server-only lib (NOT a "use server" module) so it can't be called directly
 * from the client. On success it returns the pending row but does NOT delete it —
 * the caller deletes after it has created the account.
 */
export async function verifyOtp(
  email: string,
  code: string,
  kind: "register" | "guest" | "reset",
): Promise<OtpResult> {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, state: { step: "verify", email, error: "Kode harus 6 digit angka." } };
  }
  // Hard per-email cap on guess throughput, independent of the resend reset.
  if (!rateLimit(`verify:email:${email}`, 12, OTP_TTL_MIN * 60_000)) {
    return { ok: false, state: { step: "verify", email, error: "Terlalu banyak percobaan. Coba lagi nanti." } };
  }

  const pending = await prisma.emailVerification.findUnique({ where: { email } });
  if (!pending || pending.kind !== kind) {
    return { ok: false, state: { error: "Sesi verifikasi tidak ditemukan. Silakan ulang dari awal." } };
  }
  if (pending.expiresAt < new Date()) {
    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
    return { ok: false, state: { error: "Kode sudah kedaluwarsa. Silakan ulang dari awal." } };
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
    return { ok: false, state: { error: "Terlalu banyak percobaan salah. Silakan ulang dari awal." } };
  }

  const good = await bcrypt.compare(code, pending.codeHash);
  if (!good) {
    // Atomic, cap-guarded increment so concurrent guesses can't slip past a stale read.
    const bumped = await prisma.emailVerification.updateMany({
      where: { email, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count === 0) {
      await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
      return { ok: false, state: { error: "Terlalu banyak percobaan salah. Silakan ulang dari awal." } };
    }
    const left = OTP_MAX_ATTEMPTS - (pending.attempts + 1);
    return {
      ok: false,
      state: {
        step: "verify",
        email,
        error: left > 0 ? `Kode salah. Sisa ${left} percobaan.` : "Kode salah. Silakan ulang dari awal.",
      },
    };
  }

  return {
    ok: true,
    pending: {
      email: pending.email,
      name: pending.name,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
    },
  };
}
