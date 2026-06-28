import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Referral landing: store the code in a cookie (claimed on signup) then send the
 * visitor to the storefront. Link form: /r/<CODE>. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const c = String(code).trim().toUpperCase().slice(0, 16);

  const res = NextResponse.redirect(new URL("/?ref=1", req.url));
  if (/^[A-Z0-9]+$/.test(c)) {
    res.cookies.set("kilat_ref", c, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}
