import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isSimulation } from "@/lib/payment";
import { Alert, Badge, buttonStyles } from "@/components/ui";
import OrderStatusBadge from "@/components/OrderStatus";
import PayForm from "@/components/PayForm";
import CheckoutOptions from "@/components/CheckoutOptions";
import PaymentPoller from "@/components/PaymentPoller";
import OrderCountdown from "@/components/OrderCountdown";
import SecretReveal from "@/components/SecretReveal";
import RatingForm from "@/components/RatingForm";
import { expireStaleOrders } from "@/lib/orders";
import { autoRateStaleOrders, RATING_AUTO_DAYS } from "@/lib/ratings";
import { contactInfo, waLinkWith } from "@/lib/contact";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { id } = await params;
  const { success } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await expireStaleOrders();
  await autoRateStaleOrders();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { product: true, deliveredStocks: true, coupon: true, rating: true },
  });

  if (!order) notFound();
  if (order.userId !== user.id && user.role !== "ADMIN") notFound();

  const usesBalance = order.payMethod === "BALANCE";
  const isFree = order.total <= 0;
  const simulation = isSimulation();

  // Split delivered credentials into live vs superseded (warranty-replaced).
  const activeStocks = order.deliveredStocks.filter((s) => !s.replacedAt);
  const replacedStocks = order.deliveredStocks.filter((s) => s.replacedAt);
  const showCredentials = order.status === "COMPLETED" || order.status === "REFUNDED";
  const hasDelivered = activeStocks.length > 0 || replacedStocks.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="brutal-link text-sm">
          ← Kembali ke dashboard
        </Link>
        {order.status !== "PENDING" && order.status !== "EXPIRED" && (
          <Link
            href={`/dashboard/orders/${id}/invoice`}
            className={buttonStyles("white", "sm")}
          >
            🧾 Invoice
          </Link>
        )}
      </div>

      <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">
              {order.product.name}
              {order.variantName && (
                <span className="text-ink/60"> — {order.variantName}</span>
              )}
            </h1>
            <p className="text-sm font-medium text-ink/50">{order.orderNumber}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <dl className="mt-5 space-y-1.5 text-sm">
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
              <dt className="font-medium">Diskon Reseller</dt>
              <dd className="font-bold">− {formatIDR(order.resellerDiscount)}</dd>
            </div>
          )}
          {order.flashDiscount > 0 && (
            <div className="flex justify-between text-secondary">
              <dt className="font-medium">⚡ Diskon Flash Sale</dt>
              <dd className="font-bold">− {formatIDR(order.flashDiscount)}</dd>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between text-secondary">
              <dt className="font-medium">
                Diskon {order.coupon ? `(${order.coupon.code})` : ""}
              </dt>
              <dd className="font-bold">− {formatIDR(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t-3 border-ink pt-2">
            <dt className="font-bold uppercase">Total</dt>
            <dd className="font-display text-lg">{formatIDR(order.total)}</dd>
          </div>
          {order.status !== "PENDING" && (
            <div className="flex justify-between pt-1">
              <dt className="text-ink/60">Metode</dt>
              <dd>
                <Badge variant={usesBalance ? "grape" : "accent"}>
                  {usesBalance ? "Saldo" : "Bayar Langsung"}
                </Badge>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* PENDING -> payment */}
      {order.status === "PENDING" && (
        <div className="mt-5 border-3 border-ink bg-main p-6 shadow-brutal">
          <h2 className="font-display text-xl">Pilih Metode Pembayaran</h2>

          {order.expiresAt && (
            <div className="mt-3 flex items-center justify-between gap-2 border-3 border-ink bg-white px-4 py-2 text-sm">
              <span className="font-bold uppercase">⏳ Bayar dalam</span>
              <OrderCountdown deadline={order.expiresAt.toISOString()} />
            </div>
          )}

          {isFree ? (
            <>
              <p className="mt-1 mb-4 text-sm font-medium text-ink/70">
                Pesanan ini gratis (kupon). Klaim sekarang!
              </p>
              <PayForm orderId={order.id} method="GATEWAY" label="🎁 Klaim Gratis" />
            </>
          ) : (
            <>
              <p className="mt-1 mb-4 text-sm font-medium text-ink/70">
                Bayar pakai <strong>saldo</strong> kamu, atau <strong>langsung</strong>{" "}
                lewat pembayaran. Total <strong>{formatIDR(order.total)}</strong>.
              </p>
              <CheckoutOptions
                orderId={order.id}
                total={order.total}
                balance={user.balance}
                simulation={simulation}
              />
              {!simulation && <PaymentPoller orderId={order.id} />}
            </>
          )}
        </div>
      )}

      {/* COMPLETED / REFUNDED -> show delivered credentials */}
      {showCredentials && (
        <div className="mt-5 space-y-4">
          {success && order.status === "COMPLETED" && (
            <Alert tone="success">
              🎉 Pembayaran berhasil! Akun kamu sudah dikirim otomatis di bawah ini.
            </Alert>
          )}
          {order.status === "REFUNDED" && (
            <Alert tone="info">
              ↩️ Pesanan ini telah direfund. Dana {formatIDR(order.total)} dikembalikan
              ke saldo kamu.
            </Alert>
          )}
          {hasDelivered && (
            <div className="border-3 border-ink bg-white p-6 shadow-brutal">
              <h2 className="font-display text-xl">🔓 Akun Kamu</h2>
              <p className="mt-1 mb-4 text-sm font-medium text-ink/60">
                Simpan baik-baik. Jangan ganti password tanpa izin agar garansi tetap
                berlaku. Detail juga dikirim ke email
                {user.phone ? " & WhatsApp" : ""} kamu.
              </p>
              <div className="space-y-3">
                {activeStocks.map((s, i) => (
                  <SecretReveal key={s.id} secret={s.secret} note={s.note} index={i} />
                ))}
              </div>

              {replacedStocks.length > 0 && (
                <details className="group mt-4 border-3 border-ink bg-paper">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-ink/60">
                    Akun lama (sudah diganti) · {replacedStocks.length}
                  </summary>
                  <div className="space-y-2 border-t-3 border-ink p-3 opacity-60">
                    {replacedStocks.map((s) => (
                      <code key={s.id} className="block break-all font-mono text-sm line-through">
                        {s.secret}
                      </code>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* COMPLETED -> rate the product */}
      {order.status === "COMPLETED" && (
        <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal">
          <h2 className="font-display text-xl">⭐ Nilai Produk Ini</h2>
          {order.rating ? (
            <div className="mt-3">
              <div className="text-2xl leading-none">
                {"⭐".repeat(order.rating.stars)}
                <span className="opacity-25 grayscale">
                  {"⭐".repeat(5 - order.rating.stars)}
                </span>
              </div>
              {order.rating.comment && (
                <p className="mt-2 text-sm font-medium text-ink/70">
                  “{order.rating.comment}”
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-ink/50">
                {order.rating.isAuto
                  ? "Dinilai otomatis ⭐⭐⭐⭐⭐ (kamu tidak menilai dalam batas waktu)."
                  : "Terima kasih sudah menilai!"}
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 mb-4 text-sm font-medium text-ink/60">
                Gimana pengalamanmu? Kalau tidak dinilai dalam {RATING_AUTO_DAYS} hari,
                otomatis jadi ⭐⭐⭐⭐⭐.
              </p>
              <RatingForm orderId={order.id} />
            </>
          )}
        </div>
      )}

      {/* PAID -> manual order awaiting admin delivery */}
      {order.status === "PAID" && (
        <div className="mt-5">
          <Alert tone="success">
            🎉 Pembayaran berhasil! Pesanan kamu sedang <strong>diproses admin</strong>.
            Produk akan muncul di halaman ini setelah dikirim (biasanya maks 1×24 jam).
          </Alert>
        </div>
      )}

      {/* FAILED / EXPIRED */}
      {(order.status === "FAILED" || order.status === "EXPIRED") && (
        <div className="mt-5">
          <Alert tone="error">
            {order.status === "FAILED"
              ? "Pesanan ini gagal diproses."
              : "Pesanan ini dibatalkan karena melewati batas waktu pembayaran."}{" "}
            Silakan buat pesanan baru.
          </Alert>
          <Link href="/produk" className={`${buttonStyles("ink", "md")} mt-4`}>
            Belanja Lagi
          </Link>
        </div>
      )}

      {/* Context-aware help: prefilled chat with this invoice number */}
      {(() => {
        const contact = contactInfo();
        const msg = `Halo admin, saya butuh bantuan untuk pesanan ${order.orderNumber}.`;
        const waHref = waLinkWith(msg);
        const href = waHref || (contact.email ? `mailto:${contact.email}?subject=${encodeURIComponent("Bantuan pesanan " + order.orderNumber)}` : "/kontak");
        const isWa = !!waHref;
        return (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-3 border-ink bg-surface p-4 shadow-brutal">
            <div className="text-sm font-medium">
              <span className="font-bold">Ada kendala dengan pesanan ini?</span>
              <br />
              Hubungi admin, pesanmu sudah otomatis menyertakan no. invoice.
            </div>
            <a
              href={href}
              target={isWa ? "_blank" : undefined}
              rel={isWa ? "noopener noreferrer" : undefined}
              className={`${buttonStyles("lime", "md")} shrink-0`}
            >
              {isWa ? "💬 Chat Admin" : "✉️ Hubungi Admin"}
            </a>
          </div>
        );
      })()}
    </div>
  );
}
