import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/orders";

/**
 * Cancels overdue unpaid orders. Call on a schedule (e.g. Vercel Cron or any
 * external scheduler). If CRON_SECRET is set, send `Authorization: Bearer <secret>`.
 * Orders are also expired lazily on dashboard/admin reads, so this is optional.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const expired = await expireStaleOrders();
  return NextResponse.json({ expired });
}
