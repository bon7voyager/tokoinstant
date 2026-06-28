import { requireReseller } from "@/lib/api-key";
import { apiOk, apiError } from "@/lib/api-response";
import { listResellerProducts } from "@/lib/reseller-catalog";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireReseller(req);
  if (user instanceof Response) return user;
  if (!rateLimit(`api:${user.id}`, 120, 60_000))
    return apiError(429, "rate_limited", "Terlalu banyak permintaan. Coba lagi sebentar.");

  const products = await listResellerProducts();
  return apiOk({ products });
}
