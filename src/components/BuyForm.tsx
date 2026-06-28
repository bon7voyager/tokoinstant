"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createOrderAction, verifyGuestCheckoutAction } from "@/app/actions/orders";
import { resendRegistrationCodeAction } from "@/app/actions/auth";
import { applyCouponAction } from "@/app/actions/coupons";
import { Button, Alert, Input } from "@/components/ui";
import Turnstile from "@/components/Turnstile";
import { cn, formatIDR } from "@/lib/utils";

type VariantOption = {
  id: string;
  name: string;
  price: number; // reseller-adjusted unit price
  listPrice: number | null; // original (for resellers)
  stockAvailable: number;
};

export default function BuyForm({
  productId,
  price,
  listPrice = null,
  stockAvailable,
  variants,
  isLoggedIn,
  manual = false,
  turnstileSiteKey,
}: {
  productId: string;
  price: number; // used when there are no variants
  listPrice?: number | null;
  stockAvailable: number;
  variants?: VariantOption[];
  isLoggedIn: boolean;
  manual?: boolean;
  turnstileSiteKey: string;
}) {
  const hasVariants = !!variants && variants.length > 0;
  const [state, formAction, pending] = useActionState(createOrderAction, undefined);
  const [vState, verifyAction, vPending] = useActionState(verifyGuestCheckoutAction, undefined);
  const [rState, resendAction, rPending] = useActionState(resendRegistrationCodeAction, undefined);
  const [variantId, setVariantId] = useState(hasVariants ? variants![0].id : "");
  const [qty, setQty] = useState(1);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<"buy" | "verify">("buy");
  const pathname = usePathname();

  // Guests get an email-code step before the order is created.
  useEffect(() => {
    if (state?.step === "verify") setPhase("verify");
  }, [state]);

  // Selected variant drives price & stock (falls back to product-level props).
  const sel = hasVariants ? variants!.find((v) => v.id === variantId) ?? variants![0] : null;
  const curPrice = sel ? sel.price : price;
  const curList = sel ? sel.listPrice : listPrice;
  const curStock = sel ? sel.stockAvailable : stockAvailable;

  const max = manual ? 10 : Math.max(1, Math.min(curStock, 10));
  const soldOut = !manual && curStock <= 0;
  const subtotal = curPrice * qty;
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  const guestEmail = state?.email ?? vState?.email ?? rState?.email ?? "";

  function resetCoupon() {
    setApplied(null);
    setCouponMsg(null);
  }
  function changeQty(next: number) {
    setQty(next);
    resetCoupon();
  }
  function pickVariant(id: string) {
    setVariantId(id);
    setQty(1);
    resetCoupon();
  }

  async function applyCoupon() {
    if (!code.trim()) return;
    setChecking(true);
    setCouponMsg(null);
    const fd = new FormData();
    fd.set("code", code);
    fd.set("subtotal", String(subtotal));
    const res = await applyCouponAction(undefined, fd);
    setChecking(false);
    if (res?.applied) {
      setApplied({ discount: res.applied.discount });
      setCouponMsg({ tone: "success", text: `Kupon dipakai! Hemat ${formatIDR(res.applied.discount)}.` });
    } else {
      setApplied(null);
      setCouponMsg({ tone: "error", text: res?.error ?? "Kupon tidak valid." });
    }
  }

  // --- Guest email-verification step ---
  if (phase === "verify") {
    return (
      <div className="space-y-4">
        <div className="border-3 border-ink bg-paper p-4">
          <p className="text-sm font-medium">
            Kami kirim kode 6 digit ke <b className="break-all">{guestEmail}</b>. Masukkan
            untuk menyelesaikan pesanan — akun otomatis dibuat & info login dikirim ke
            emailmu.
          </p>
        </div>

        {vState?.error && <Alert tone="error">{vState.error}</Alert>}
        {rState?.resent && !vState?.error && (
          <Alert tone="success">Kode baru sudah dikirim ke emailmu.</Alert>
        )}
        {rState?.error && <Alert tone="error">{rState.error}</Alert>}

        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={guestEmail} />
          <input type="hidden" name="productId" value={productId} />
          {hasVariants && <input type="hidden" name="variantId" value={variantId} />}
          <input type="hidden" name="quantity" value={qty} />
          {applied && <input type="hidden" name="couponCode" value={code} />}
          <div>
            <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">
              Kode Verifikasi
            </span>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="text-center font-display text-2xl tracking-[0.5em]"
              required
            />
          </div>
          <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={vPending}>
            {vPending ? "Memproses..." : "Verifikasi & Lanjut Bayar"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm font-medium">
          <form action={resendAction}>
            <input type="hidden" name="email" value={guestEmail} />
            <button type="submit" className="brutal-link" disabled={rPending}>
              {rPending ? "Mengirim..." : "Kirim ulang kode"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setPhase("buy")}
            className="text-ink/60 underline decoration-2 underline-offset-2"
          >
            ← Ubah data
          </button>
        </div>
      </div>
    );
  }

  // --- Buy step ---
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {hasVariants && <input type="hidden" name="variantId" value={variantId} />}
      <input type="hidden" name="quantity" value={qty} />
      {applied && <input type="hidden" name="couponCode" value={code} />}

      {state?.error && <Alert tone="error">{state.error}</Alert>}

      {/* Variant selector */}
      {hasVariants && (
        <div>
          <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">Pilih Varian</span>
          <div className="flex flex-wrap gap-2">
            {variants!.map((v) => {
              const vSold = !manual && v.stockAvailable <= 0;
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => pickVariant(v.id)}
                  aria-pressed={v.id === variantId}
                  className={cn(
                    "border-3 border-ink px-3 py-2 text-left shadow-brutal-sm transition-all",
                    v.id === variantId ? "bg-main" : "bg-white hover:-translate-y-0.5",
                    vSold && "opacity-60",
                  )}
                >
                  <span className="block text-sm font-bold">{v.name}</span>
                  <span className="block text-xs font-medium">
                    {formatIDR(v.price)}
                    {vSold ? " · habis" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!soldOut && (
        <div>
          <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">Jumlah</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changeQty(Math.max(1, qty - 1))}
              className="h-11 w-11 border-3 border-ink bg-white text-xl font-bold shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              −
            </button>
            <span className="w-12 text-center font-display text-2xl">{qty}</span>
            <button
              type="button"
              onClick={() => changeQty(Math.min(max, qty + 1))}
              className="h-11 w-11 border-3 border-ink bg-white text-xl font-bold shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Guest contact — an account is auto-created from this email after verification */}
      {!isLoggedIn && !soldOut && (
        <div className="space-y-3 border-3 border-ink bg-paper p-4">
          <span className="block text-sm font-bold uppercase tracking-wide">Data Pembeli</span>
          <div>
            <label htmlFor="guestEmail" className="mb-1 block text-xs font-bold uppercase text-ink/60">
              Email
            </label>
            <Input
              id="guestEmail"
              name="guestEmail"
              type="email"
              placeholder="kamu@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="guestPhone" className="mb-1 block text-xs font-bold uppercase text-ink/60">
              WhatsApp (opsional)
            </label>
            <Input id="guestPhone" name="guestPhone" placeholder="0812xxxxxxx" autoComplete="tel" />
          </div>
          <Turnstile siteKey={turnstileSiteKey} />
          <p className="text-xs font-medium text-ink/60">
            Kami kirim kode verifikasi ke emailmu dulu. Sudah punya akun?{" "}
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="brutal-link">
              Login
            </Link>
          </p>
        </div>
      )}

      {/* Coupon */}
      {!soldOut && isLoggedIn && (
        <div>
          <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">Kupon</span>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                resetCoupon();
              }}
              placeholder="KODE KUPON"
              className="uppercase"
            />
            <Button type="button" variant="accent" onClick={applyCoupon} disabled={checking || !code.trim()}>
              {checking ? "..." : "Terapkan"}
            </Button>
          </div>
          {couponMsg && (
            <p className={`mt-1.5 text-sm font-bold ${couponMsg.tone === "error" ? "text-secondary" : "text-ink"}`}>
              {couponMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="space-y-1 border-3 border-ink bg-paper px-4 py-3">
        {curList && curList > curPrice && (
          <div className="flex items-center justify-between text-sm text-grape">
            <span className="font-bold uppercase">🏷️ Harga Reseller</span>
            <span className="font-bold">hemat {formatIDR((curList - curPrice) * qty)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold uppercase text-ink/60">Subtotal</span>
          <span className="font-bold">{formatIDR(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between text-sm text-secondary">
            <span className="font-bold uppercase">Diskon</span>
            <span className="font-bold">− {formatIDR(discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t-3 border-ink pt-1.5">
          <span className="font-bold uppercase">Total</span>
          <span className="font-display text-2xl">{formatIDR(total)}</span>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        variant={soldOut ? "white" : "secondary"}
        className="w-full"
        disabled={soldOut || pending}
      >
        {soldOut
          ? "Stok Habis"
          : pending
            ? "Memproses..."
            : isLoggedIn
              ? "Lanjut ke Pembayaran"
              : "Lanjut →"}
      </Button>

      {!isLoggedIn && !soldOut && (
        <p className="text-center text-sm font-medium text-ink/50">
          Verifikasi email dulu, lalu pilih metode bayar.
        </p>
      )}
      {isLoggedIn && !soldOut && (
        <p className="text-center text-sm font-medium text-ink/50">
          Pilih bayar pakai <strong>saldo</strong> atau <strong>langsung</strong> di
          halaman berikutnya.
        </p>
      )}
    </form>
  );
}
