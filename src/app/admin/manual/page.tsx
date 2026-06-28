import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import ManualDeliverForm from "@/components/ManualDeliverForm";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink/60">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
    </div>
  );
}

export default async function AdminManualOrdersPage() {
  // Paid orders for MANUAL-fulfillment products are the ones waiting on the admin
  // to deliver the account/credential by hand. Oldest first = process-queue order.
  const orders = await prisma.order.findMany({
    where: { status: "PAID", product: { fulfillment: "MANUAL" } },
    include: { user: true, product: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="font-display text-3xl">Pesanan Manual</h1>
      <p className="font-medium text-ink/60">
        Pesanan sudah dibayar &amp; menunggu kamu kirim manual.{" "}
        <b>{orders.length}</b> menunggu diproses.
      </p>

      {orders.length === 0 ? (
        <div className="mt-6 border-3 border-ink bg-white p-10 text-center shadow-brutal">
          <div className="font-display text-2xl">🎉 Semua beres!</div>
          <p className="mt-1 font-medium text-ink/60">
            Tidak ada pesanan manual yang menunggu dikirim.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {orders.map((o) => (
            <div key={o.id} className="border-3 border-ink bg-white shadow-brutal">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-3 border-ink bg-main px-5 py-4">
                <div className="min-w-0">
                  <div className="font-display text-lg leading-tight">
                    {o.product.name}
                    {o.variantName && <span className="text-ink/70"> — {o.variantName}</span>}
                  </div>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-mono text-xs underline decoration-2 underline-offset-2 transition-colors hover:text-secondary"
                    title="Buka detail pesanan lengkap"
                  >
                    {o.orderNumber}
                  </Link>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl">{formatIDR(o.total)}</div>
                  <div className="text-xs font-bold uppercase text-ink/60">{o.quantity} item</div>
                </div>
              </div>

              {/* Body: buyer detail + deliver form */}
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">
                    Detail Pembeli
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    <Row k="Nama" v={o.user.name} />
                    <Row k="Email" v={o.user.email} />
                    {o.user.phone && <Row k="WhatsApp" v={o.user.phone} />}
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/60">Tipe</dt>
                      <dd>
                        {o.resellerDiscount > 0 ? (
                          <Badge variant="lime">💎 Reseller</Badge>
                        ) : (
                          <Badge variant="white">Biasa</Badge>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink/60">Metode</dt>
                      <dd>
                        <Badge variant={o.payMethod === "BALANCE" ? "grape" : "accent"}>
                          {o.payMethod === "BALANCE" ? "Saldo" : "Bayar Langsung"}
                        </Badge>
                      </dd>
                    </div>
                    <Row k="Dibayar" v={formatDate(o.paidAt ?? o.createdAt)} />
                  </dl>
                </div>

                <div className="border-t-3 border-ink pt-4 md:border-l-3 md:border-t-0 md:pl-5 md:pt-0">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">
                    📨 Kirim Produk ke Pembeli
                  </h3>
                  <ManualDeliverForm orderId={o.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
