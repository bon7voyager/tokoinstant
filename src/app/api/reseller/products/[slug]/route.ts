import { requireReseller } from "@/lib/api-key";
import { apiOk, apiError } from "@/lib/api-response";
import { getResellerProduct } from "@/lib/reseller-catalog";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await requireReseller(req);
  if (user instanceof Response) return user;
  if (!rateLimit(`api:${user.id}`, 120, 60_000))
    return apiError(429, "rate_limited", "Terlalu banyak permintaan. Coba lagi sebentar.");

  const { slug } = await params;
  const product = await getResellerProduct(slug);
  if (!product) return apiError(404, "product_not_found", "Produk tidak ditemukan.");
  return apiOk({ product });
}
