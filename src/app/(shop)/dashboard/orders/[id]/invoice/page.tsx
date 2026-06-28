import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { contactInfo } from "@/lib/contact";
import { formatIDR, formatDate } from "@/lib/utils";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Pembayaran",
  PAID: "Dibayar — Diproses",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  REFUNDED: "Dana Dikembalikan",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/orders/${id}/invoice`);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      product: { select: { name: true } },
      user: { select: { name: true, email: true } },
      coupon: { select: { code: true } },
    },
  });
  if (!order || (order.userId !== user.id && user.role !== "ADMIN")) notFound();

  const contact = contactInfo();
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME?.trim() || "Kilat Shop";

  const Row = ({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) => (
    <div className="flex justify-between gap-4 py-0.5">
      <dt className="text-ink/60">{k}</dt>
      <dd className={strong ? "font-display text-lg" : "font-medium"}>{v}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <style>{`@media print{
        body *{visibility:hidden!important}
        #invoice-sheet,#invoice-sheet *{visibility:visible!important}
        #invoice-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none!important;border-width:0!important}
        .no-print{display:none!important}
      }`}</style>

      {/* Actions (hidden when printing) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/orders/${id}`} className="brutal-link text-sm">
          ← Kembali ke pesanan
        </Link>
        <PrintButton />
      </div>

      <div
        id="invoice-sheet"
        className="border-3 border-ink bg-white p-6 shadow-brutal sm:p-8"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-3 border-ink pb-4">
          <div>
            <div className="font-display text-2xl">⚡ {storeName}</div>
            <div className="text-xs font-medium text-ink/55">Produk digital otomatis</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl uppercase">Invoice</div>
            <div className="font-mono text-xs text-ink/60">{order.orderNumber}</div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">
              Ditagihkan ke
            </div>
            <div className="font-bold">{order.user.name}</div>
            <div className="text-ink/60">{order.user.email}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink/45">
              Tanggal
            </div>
            <div className="font-medium">{formatDate(order.createdAt)}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink/45">
              Status
            </div>
            <div className="font-bold">{STATUS_LABEL[order.status] ?? order.status}</div>
          </div>
        </div>

        {/* Item */}
        <table className="mt-5 w-full border-3 border-ink text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Harga</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-2 font-bold">
                {order.product.name}
                {order.variantName && (
                  <span className="font-medium text-ink/60"> — {order.variantName}</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">{order.quantity}</td>
              <td className="px-3 py-2 text-right font-medium">
                {formatIDR(order.subtotal || order.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <dl className="mt-4 ml-auto max-w-xs text-sm">
          <Row k="Subtotal" v={formatIDR(order.subtotal || order.total)} />
          {order.resellerDiscount > 0 && (
            <Row k="Diskon Reseller" v={`− ${formatIDR(order.resellerDiscount)}`} />
          )}
          {order.flashDiscount > 0 && (
            <Row k="⚡ Diskon Flash Sale" v={`− ${formatIDR(order.flashDiscount)}`} />
          )}
          {order.discount > 0 && (
            <Row
              k={`Diskon Kupon${order.coupon ? ` (${order.coupon.code})` : ""}`}
              v={`− ${formatIDR(order.discount)}`}
            />
          )}
          <div className="mt-1 flex justify-between gap-4 border-t-3 border-ink pt-2">
            <dt className="font-display text-lg">TOTAL</dt>
            <dd className="font-display text-lg">{formatIDR(order.total)}</dd>
          </div>
          <div className="mt-1 text-right text-xs font-medium text-ink/55">
            Metode: {order.payMethod === "BALANCE" ? "Saldo" : "Gateway"}
          </div>
        </dl>

        {/* Footer */}
        <div className="mt-6 border-t-3 border-ink pt-3 text-center text-xs font-medium text-ink/55">
          Terima kasih telah berbelanja di {storeName}! Butuh bantuan?{" "}
          {contact.email ? <span>Email {contact.email}</span> : null}
          {contact.whatsapp ? <span> · WA {contact.waDisplay}</span> : null}
        </div>
      </div>
    </div>
  );
}
