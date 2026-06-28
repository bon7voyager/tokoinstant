import { NextResponse } from "next/server";
import { TripayProvider } from "@/lib/payment/tripay";
import { tripayReady } from "@/lib/payment/config";
import { handleWebhookResult } from "@/lib/payment/webhook";

export async function POST(req: Request) {
  if (!tripayReady()) {
    return NextResponse.json({ success: false, message: "tripay not configured" }, { status: 503 });
  }
  const rawBody = await req.text();
  const provider = new TripayProvider();
  const result = await provider.parseWebhook({ headers: req.headers, rawBody });
  const res = await handleWebhookResult(result);
  return NextResponse.json(res.body, { status: res.status });
}
