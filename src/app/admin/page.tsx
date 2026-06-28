import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OrderStatusBadge from "@/components/OrderStatus";
import { Badge } from "@/components/ui";
import { isPremium } from "@/lib/membership";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [
    revenueAgg,
    totalOrders,
    pendingOrders,
    manualPending,
    totalUsers,
    totalProducts,
    lowStock,
    recent,
    newThisWeek,
    newUsers,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: "COMPLETED" },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PAID", product: { fulfillment: "MANUAL" } } }),
    prisma.user.count(),
    prisma.product.count(),
    prisma.stock.groupBy({
      by: ["productId"],
      where: { status: "AVAILABLE" },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      include: { product: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isGuest: true,
        premiumUntil: true,
        createdAt: true,
      },
    }),
  ]);

  const lowStockCount = lowStock.filter((g) => g._count._all <= 3).length;

  const stats = [
    { label: "Pendapatan", value: formatIDR(revenueAgg._sum.total ?? 0), bg: "bg-lime", sub: null as string | null },
    { label: "Total Pesanan", value: totalOrders, bg: "bg-main", sub: null as string | null },
    { label: "Menunggu Bayar", value: pendingOrders, bg: "bg-accent", sub: null as string | null },
    {
      label: "Pengguna",
      value: totalUsers,
      bg: "bg-grape text-white",
      sub: `+${newThisWeek} baru minggu ini`,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl">Ringkasan</h1>
      <p className="font-medium text-ink/60">Pantau toko kamu sekilas.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`border-3 border-ink ${s.bg} p-5 shadow-brutal`}>
            <div className="text-sm font-bold uppercase tracking-wide opacity-70">
              {s.label}
            </div>
            <div className="mt-1 font-display text-2xl">{s.value}</div>
            {s.sub && (
              <div className="mt-0.5 text-xs font-bold uppercase tracking-wide opacity-70">
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {manualPending > 0 && (
        <Link
          href="/admin/manual"
          className="mt-4 flex items-center justify-between border-3 border-ink bg-accent p-5 shadow-brutal transition-all hover:-translate-y-0.5 hover:shadow-brutal-lg"
        >
          <div>
            <div className="text-sm font-bold uppercase opacity-80">📨 Perlu Dikirim Manual</div>
            <div className="font-display text-2xl">{manualPending} pesanan menunggu</div>
          </div>
          <span className="font-bold uppercase">Proses →</span>
        </Link>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="border-3 border-ink bg-white p-5 shadow-brutal">
          <div className="text-sm font-bold uppercase text-ink/60">Total Produk</div>
          <div className="font-display text-2xl">{totalProducts}</div>
        </div>
        <Link
          href="/admin/stock"
          className="border-3 border-ink bg-secondary p-5 text-white shadow-brutal transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg"
        >
          <div className="text-sm font-bold uppercase opacity-80">⚠️ Stok Menipis</div>
          <div className="font-display text-2xl">{lowStockCount} produk</div>
          <div className="text-xs font-medium opacity-80">≤ 3 stok tersisa — klik untuk isi</div>
        </Link>
      </div>

      {/* Recent orders */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-2xl">Pesanan Terbaru</h2>
        <Link href="/admin/orders" className="brutal-link text-sm">
          Lihat semua →
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Pembeli</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada pesanan.
                </td>
              </tr>
            ) : (
              recent.map((o) => (
                <tr key={o.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-xs underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                      title="Lihat detail pesanan ini"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{o.user.name}</td>
                  <td className="px-4 py-3">{o.product.name}</td>
                  <td className="px-4 py-3 font-bold">{formatIDR(o.total)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Newest registered users */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-2xl">Pengguna Baru</h2>
        <Link href="/admin/users" className="brutal-link text-sm">
          Lihat semua →
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Bergabung</th>
            </tr>
          </thead>
          <tbody>
            {newUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada pengguna.
                </td>
              </tr>
            ) : (
              newUsers.map((u) => (
                <tr key={u.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}/transactions`}
                      className="font-bold underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                      title="Lihat riwayat transaksi pengguna ini"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.role === "ADMIN" ? (
                        <Badge variant="grape">Admin</Badge>
                      ) : (
                        <Badge variant="white">User</Badge>
                      )}
                      {isPremium(u) && <Badge variant="lime">💎 Reseller</Badge>}
                      {u.isGuest && <Badge variant="white">👤 Tamu</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/60">{formatDate(u.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
