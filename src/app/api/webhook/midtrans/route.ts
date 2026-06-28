import { NextResponse } from "next/server";
import { MidtransProvider } from "@/lib/payment/midtrans";
import { midtransReady } from "@/lib/payment/config";
import { handleWebhookResult } from "@/lib/payment/webhook";

export async function POST(req: Request) {
  if (!midtransReady()) {
    return NextResponse.json({ error: "midtrans not configured" }, { status: 503 });
  }
  const rawBody = await req.text();
  const provider = new MidtransProvider();
  const result = await provider.parseWebhook({ headers: req.headers, rawBody });
  const res = await handleWebhookResult(result);
  return NextResponse.json(res.body, { status: res.status });
}
