import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForProfile, googleConfigured } from "@/lib/google-oauth";
import { signSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { attachReferralFromCookie } from "@/lib/referral";
import { clientIp } from "@/lib/rate-limit";

const STATE_COOKIE = "g_oauth_state";

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function fail(req: Request, reason: string) {
  // Consume the state cookie on failure too, so a state token is single-use.
  const res = NextResponse.redirect(new URL(`/login?error=${reason}`, req.url));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: Request) {
  if (!googleConfigured()) return fail(req, "google_off");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1];

  // Validate state (CSRF) before doing anything else.
  if (!code || !state || !savedState || !safeEqual(state, savedState)) {
    return fail(req, "google");
  }

  const profile = await exchangeCodeForProfile(code);
  if (!profile) return fail(req, "google");
  if (!profile.emailVerified) return fail(req, "google_unverified");

  // Find existing account by email, or create a password-less one.
  let user = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!user) {
    const signupIp = await clientIp();
    user = await prisma.user
      .create({
        data: {
          email: profile.email,
          name: profile.name,
          password: null,
          role: "USER",
          signupIp: signupIp === "unknown" ? null : signupIp,
        },
      })
      .catch(() => null);
    if (!user) return fail(req, "google");
    await attachReferralFromCookie(user.id);
  } else if (user.isGuest) {
    // This email previously had a guest/auto-created account (possibly squatted by
    // someone who never proved ownership). Google has verified the requester owns
    // the address, so they are the rightful owner — reclaim the row: drop the
    // (attacker-settable) phone used for notifications and mark it as a real account.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isGuest: false, name: profile.name, phone: null },
    });
    await attachReferralFromCookie(user.id); // reclaimed guest from /r/<code> + clears cookie
  }

  // New Google accounts have no password yet → guide them to set one (skippable)
  // so they can also log in manually. Accounts that already have a password skip this.
  const dest = !user.password
    ? "/buat-password"
    : user.role === "ADMIN"
      ? "/admin"
      : "/dashboard";

  const token = await signSessionToken(user.id, user.role);
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
