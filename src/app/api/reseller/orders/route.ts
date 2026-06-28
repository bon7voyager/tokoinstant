import { requireReseller } from "@/lib/api-key";
import { apiOk, apiError } from "@/lib/api-response";
import { placeApiOrder, listApiOrders } from "@/lib/reseller-orders";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireReseller(req);
  if (user instanceof Response) return user;
  if (!rateLimit(`api:${user.id}`, 120, 60_000))
    return apiError(429, "rate_limited", "Terlalu banyak permintaan. Coba lagi sebentar.");

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get("limit")) || 20)));
  const result = await listApiOrders(user.id, {
    limit,
    status: url.searchParams.get("status"),
    cursor: url.searchParams.get("cursor"),
  });
  return apiOk(result);
}

export async function POST(req: Request) {
  const user = await requireReseller(req);
  if (user instanceof Response) return user;
  if (!rateLimit(`api:order:${user.id}`, 60, 60_000))
    return apiError(429, "rate_limited", "Terlalu banyak order. Coba lagi sebentar.");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "invalid_json", "Body harus JSON.");
  }

  const productSlug = String(body.product ?? "").trim();
  const refId = String(body.ref_id ?? "").trim();
  const payMethodRaw = String(body.pay_method ?? "balance").trim().toLowerCase();
  const variantId = body.variant_id ? String(body.variant_id) : null;
  const quantity = Number(body.quantity ?? 1);

  if (!productSlug) return apiError(400, "product_required", "Field 'product' (slug) wajib diisi.");
  if (!refId)
    return apiError(400, "ref_id_required", "Field 'ref_id' (id order kamu) wajib untuk idempotency.");
  if (refId.length > 100) return apiError(400, "ref_id_too_long", "ref_id maksimal 100 karakter.");
  if (payMethodRaw !== "balance" && payMethodRaw !== "gateway")
    return apiError(400, "invalid_pay_method", "pay_method harus 'balance' atau 'gateway'.");

  const result = await placeApiOrder(user, {
    productSlug,
    variantId,
    quantity,
    payMethod: payMethodRaw === "gateway" ? "GATEWAY" : "BALANCE",
    refId,
  });
  if (!result.ok) return apiError(result.status, result.code, result.message);
  return apiOk({ order: result.order }, 201);
}
