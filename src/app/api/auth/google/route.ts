import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { googleConfigured, getGoogleAuthUrl } from "@/lib/google-oauth";

const STATE_COOKIE = "g_oauth_state";

export async function GET(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_off", req.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getGoogleAuthUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
