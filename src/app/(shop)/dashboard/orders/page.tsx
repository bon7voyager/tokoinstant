import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { expireStaleOrders } from "@/lib/orders";
import OrderStatusBadge from "@/components/OrderStatus";
import { productVisual } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/orders");

  await expireStaleOrders();

  const { page: pageRaw } = await searchParams;

  const totalOrders = await prisma.order.count({ where: { userId: user.id } });
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/dashboard" className="brutal-link text-sm">
        ← Kembali ke dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Pesanan Saya</h1>
        <Link href="/produk" className={`brutal-link text-sm`}>
          + Belanja Lagi
        </Link>
      </div>

      <div className="mt-6">
        {totalOrders === 0 ? (
          <EmptyState
            emoji="🛍️"
            title="Belum ada pesanan"
            desc="Yuk mulai belanja produk digital favoritmu."
            cta={{ href: "/produk", label: "Belanja Sekarang" }}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const v = productVisual(o.product.name);
              return (
                <Link
                  key={o.id}
                  href={`/dashboard/orders/${o.id}`}
                  className="flex items-center gap-4 border-3 border-ink bg-white p-4 shadow-brutal transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg"
                >
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center border-3 border-ink ${v.bg} text-2xl`}
                  >
                    {v.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">
                      {o.product.name}
                      {o.variantName ? ` — ${o.variantName}` : ""}
                    </div>
                    <div className="text-xs font-medium text-ink/50">
                      {o.orderNumber} · {formatDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display">{formatIDR(o.total)}</div>
                    <div className="mt-1">
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref="/dashboard/orders" />
    </div>
  );
}
