import { prisma } from "@/lib/prisma";
import { requireReseller } from "@/lib/api-key";
import { apiOk, apiError } from "@/lib/api-response";
import { orderView } from "@/lib/reseller-orders";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const user = await requireReseller(req);
  if (user instanceof Response) return user;
  if (!rateLimit(`api:${user.id}`, 120, 60_000))
    return apiError(429, "rate_limited", "Terlalu banyak permintaan. Coba lagi sebentar.");

  const { ref } = await params;
  // Look up by the reseller's own ref_id OR our order number — scoped to them.
  const order = await prisma.order.findFirst({
    where: { userId: user.id, OR: [{ externalRef: ref }, { orderNumber: ref }] },
    select: { id: true },
  });
  if (!order) return apiError(404, "order_not_found", "Pesanan tidak ditemukan.");

  const v = await orderView(order.id);
  return v ? apiOk({ order: v }) : apiError(404, "order_not_found", "Pesanan tidak ditemukan.");
}
