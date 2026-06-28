import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
);
export const SESSION_COOKIE = "kilat_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

type SessionPayload = {
  sub: string; // user id
  role: Role;
};

// ---- password helpers ----
export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Cryptographically-random password for auto-created (guest) accounts.
 * Excludes ambiguous characters (0/O/1/l/I) so it's easy to retype. */
export function randomPassword(len = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** A 6-digit numeric one-time code for email verification. */
export function randomOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// ---- session token ----
async function signToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

/** Sign a session JWT. Useful when the caller sets the cookie itself (e.g. an
 * OAuth callback route that attaches it to a redirect response). */
export function signSessionToken(userId: string, role: Role) {
  return signToken({ sub: userId, role });
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function createSession(userId: string, role: Role) {
  const token = await signToken({ sub: userId, role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { sub: payload.sub as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

// Cached per-request so multiple calls in one render don't re-query the DB.
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      balance: true,
      premiumUntil: true,
      createdAt: true,
    },
  });
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
