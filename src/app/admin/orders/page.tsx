import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Select } from "@/components/ui";
import OrderStatusBadge from "@/components/OrderStatus";
import Pagination from "@/components/Pagination";
import { updateOrderStatusAction } from "@/app/actions/admin";
import { expireStaleOrders } from "@/lib/orders";
import { formatIDR, formatDate, cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Menunggu" },
  { key: "PAID", label: "Diproses" },
  { key: "COMPLETED", label: "Selesai" },
  { key: "FAILED", label: "Gagal" },
];

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "PAID",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
];

const PAGE_SIZE = 10;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: pageRaw } = await searchParams;
  const filter = status && status !== "ALL" ? (status as OrderStatus) : undefined;

  await expireStaleOrders();

  const where = filter ? { status: filter } : {};
  const total = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const orders = await prisma.order.findMany({
    where,
    include: { product: true, user: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const baseHref = `/admin/orders${status ? `?status=${status}` : ""}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Pesanan</h1>
      <p className="font-medium text-ink/60">Semua transaksi yang masuk.</p>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "ALL") === f.key;
          return (
            <Link
              key={f.key}
              href={`/admin/orders?status=${f.key}`}
              className={cn(
                "border-3 border-ink px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm",
                active ? "bg-main" : "bg-white",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Pembeli</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ubah Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-ink/50">
                  Tidak ada pesanan.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-ink/10 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-xs underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                      title="Lihat detail pesanan ini"
                    >
                      {o.orderNumber}
                    </Link>
                    <div className="text-xs text-ink/50">{formatDate(o.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.user.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {o.product.name}
                    {o.variantName ? (
                      <span className="text-ink/60"> — {o.variantName}</span>
                    ) : null}
                    <div className="text-xs text-ink/50">x{o.quantity}</div>
                  </td>
                  <td className="px-4 py-3 font-bold">{formatIDR(o.total)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <form action={updateOrderStatusAction} className="flex gap-1.5">
                      <input type="hidden" name="id" value={o.id} />
                      <Select
                        name="status"
                        defaultValue={o.status}
                        className="!py-1.5 !text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                      <button className="shrink-0 border-3 border-ink bg-accent px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                        Set
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />

      <p className="mt-3 text-xs font-medium text-ink/50">
        Catatan: mengubah status manual tidak mengirim stok otomatis. Pengiriman
        otomatis terjadi saat pembeli membayar lewat alur checkout.
      </p>
    </div>
  );
}
