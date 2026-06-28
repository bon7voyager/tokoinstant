import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import OrderStatusBadge from "@/components/OrderStatus";
import AdminOrderActions from "@/components/AdminOrderActions";
import ManualDeliverForm from "@/components/ManualDeliverForm";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true, product: true, deliveredStocks: true, coupon: true },
  });
  if (!order) notFound();

  const isManual = order.product.fulfillment === "MANUAL";

  return (
    <div>
      <Link href="/admin/orders" className="brutal-link text-sm">
        ← Kembali ke pesanan
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">
            {order.product.name}
            {order.variantName && (
              <span className="text-ink/60"> — {order.variantName}</span>
            )}
          </h1>
          <p className="font-mono text-sm text-ink/50">{order.orderNumber}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="border-3 border-ink bg-white p-5 shadow-brutal">
          <h2 className="mb-3 font-display text-lg">Detail</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Pembeli</dt>
              <dd className="font-medium">{order.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Email</dt>
              <dd className="font-medium">{order.user.email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink/60">Tipe Akun</dt>
              <dd>
                {order.resellerDiscount > 0 ? (
                  <Badge variant="lime">💎 Reseller</Badge>
                ) : (
                  <Badge variant="white">Biasa</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Tanggal</dt>
              <dd className="font-medium">{formatDate(order.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Jumlah</dt>
              <dd className="font-medium">{order.quantity} item</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Subtotal</dt>
              <dd className="font-medium">{formatIDR(order.subtotal || order.total)}</dd>
            </div>
            {order.resellerDiscount > 0 && (
              <div className="flex justify-between text-grape">
                <dt>Diskon Reseller</dt>
                <dd className="font-bold">− {formatIDR(order.resellerDiscount)}</dd>
              </div>
            )}
            {order.flashDiscount > 0 && (
              <div className="flex justify-between text-secondary">
                <dt>⚡ Diskon Flash Sale</dt>
                <dd className="font-bold">− {formatIDR(order.flashDiscount)}</dd>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-secondary">
                <dt>Diskon {order.coupon ? `(${order.coupon.code})` : ""}</dt>
                <dd className="font-bold">− {formatIDR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t-3 border-ink pt-1.5">
              <dt className="font-bold uppercase">Total</dt>
              <dd className="font-display text-lg">{formatIDR(order.total)}</dd>
            </div>
            <div className="flex justify-between pt-1">
              <dt className="text-ink/60">Metode</dt>
              <dd>
                <Badge variant={order.payMethod === "BALANCE" ? "grape" : "accent"}>
                  {order.payMethod === "BALANCE" ? "Saldo" : "Bayar Langsung"}
                </Badge>
              </dd>
            </div>
            {order.paymentRef && (
              <div className="flex justify-between">
                <dt className="text-ink/60">Ref</dt>
                <dd className="font-mono text-xs">{order.paymentRef}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="border-3 border-ink bg-white p-5 shadow-brutal">
          <h2 className="mb-3 font-display text-lg">Akun Terkirim ({order.deliveredStocks.length})</h2>
          {order.deliveredStocks.length === 0 ? (
            <p className="text-sm text-ink/50">Belum ada akun terkirim.</p>
          ) : (
            <div className="space-y-2">
              {order.deliveredStocks.map((s) => (
                <div
                  key={s.id}
                  className={`border-3 border-ink bg-paper px-3 py-2 ${s.replacedAt ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code
                      className={`block break-all font-mono text-sm font-bold ${s.replacedAt ? "line-through" : ""}`}
                    >
                      {s.secret}
                    </code>
                    {s.replacedAt ? (
                      <Badge variant="white">Diganti</Badge>
                    ) : (
                      <Badge variant="lime">Aktif</Badge>
                    )}
                  </div>
                  {s.note && <span className="text-xs text-ink/60">{s.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PAID -> manual delivery (or refund if can't fulfil) */}
      {order.status === "PAID" && (
        <div className="mt-6 space-y-6">
          <div className="border-3 border-ink bg-main p-5 shadow-brutal">
            <h2 className="font-display text-xl">📨 Kirim Produk (Manual)</h2>
            <p className="mb-4 mt-1 text-sm font-medium text-ink/70">
              Pesanan ini sudah <b>dibayar</b> dan menunggu pengiriman manual. Isi detail
              produk lalu kirim — pembeli langsung menerimanya & status jadi Selesai.
            </p>
            <ManualDeliverForm orderId={order.id} />
          </div>
          <div>
            <h2 className="mb-3 font-display text-xl">Tidak bisa dikirim?</h2>
            <AdminOrderActions orderId={order.id} canWarranty={false} />
          </div>
        </div>
      )}

      {/* Refund / Warranty (delivered orders) */}
      {order.status === "COMPLETED" && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-xl">Tindakan</h2>
          <AdminOrderActions orderId={order.id} canWarranty={!isManual} />
        </div>
      )}

      {order.status !== "COMPLETED" && order.status !== "PAID" && (
        <p className="mt-6 border-3 border-ink bg-paper p-4 text-sm font-medium text-ink/60 shadow-brutal-sm">
          Tindakan tersedia setelah pesanan dibayar.
        </p>
      )}
    </div>
  );
}
