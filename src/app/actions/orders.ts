"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createSession, hashPassword, randomPassword, randomOtp } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/utils";
import { evaluateCoupon } from "@/lib/coupons";
import { isSimulation } from "@/lib/payment";
import {
  notifyOrderCompleted,
  notifyOrderPaid,
  notifyAdminNewOrder,
  notifyAccountCreated,
  notifyEmailVerification,
} from "@/lib/notify";
import { normalizePhoneID } from "@/lib/notify/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyOtp, OTP_TTL_MIN } from "@/lib/otp";
import { orderExpiryDate } from "@/lib/orders";
import { isPremium } from "@/lib/membership";
import { getFlashInfo, effectivePrice } from "@/lib/flash-sale";
import { processReferralReward, attachReferralFromCookie } from "@/lib/referral";
import { settleOrderTransaction } from "@/lib/order-settle";

export type OrderActionState =
  | { error?: string; step?: "verify"; email?: string; resent?: boolean }
  | undefined;

/** Lightweight status read for the gateway payment poller (ownership-checked). */
export async function pollOrderStatusAction(
  orderId: string,
): Promise<{ status: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, userId: true },
  });
  if (!order || order.userId !== user.id) return null;
  return { status: order.status };
}

/**
 * Parse + validate an order request from the form (server-side, never trusts the
 * client price): resolves the product, the chosen variant, and checks stock.
 * Shared by the logged-in path and the guest-checkout pre-OTP validation.
 */
async function resolveOrderRequest(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  // Coerce a missing/non-numeric quantity to 1 before clamping (NaN would
  // otherwise survive Math.max/min and poison subtotal/total).
  const qtyRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Number.isFinite(qtyRaw)
    ? Math.max(1, Math.min(10, Math.trunc(qtyRaw)))
    : 1;
  const couponCode = String(formData.get("couponCode") ?? "").trim().toUpperCase();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { where: { isActive: true } } },
  });
  if (!product || !product.isActive) {
    return { ok: false as const, error: "Produk tidak tersedia." };
  }

  let unitPrice = product.price;
  let variantId: string | null = null;
  let variantName: string | null = null;
  if (product.variants.length > 0) {
    const v = product.variants.find((x) => x.id === String(formData.get("variantId") ?? ""));
    if (!v) return { ok: false as const, error: "Pilih varian dulu." };
    unitPrice = v.price;
    variantId = v.id;
    variantName = v.name;
  }

  // Manual-delivery products have no stock pool — admin fulfils after payment.
  if (product.fulfillment === "AUTO") {
    const available = await prisma.stock.count({
      where: { productId: product.id, variantId, status: "AVAILABLE" },
    });
    if (available < quantity) {
      return {
        ok: false as const,
        error: available === 0 ? "Stok habis. Silakan cek lagi nanti." : `Stok tersisa hanya ${available}.`,
      };
    }
  }

  return { ok: true as const, product, quantity, couponCode, variantId, variantName, unitPrice };
}

/** Create the PENDING order for a known user and redirect to its payment page.
 * Not exported (so it isn't a callable server action). */
async function createOrderForUser(
  user: { id: string; premiumUntil: Date | null },
  formData: FormData,
): Promise<OrderActionState> {
  const r = await resolveOrderRequest(formData);
  if (!r.ok) return { error: r.error };
  const { product, quantity, couponCode, variantId, variantName, unitPrice } = r;

  const premium = isPremium(user);
  const subtotal = unitPrice * quantity; // list price of the chosen variant
  // Buyer pays the lowest of reseller price vs an active flash-sale price.
  const flash = await getFlashInfo(product.id);
  const eff = effectivePrice(unitPrice, premium, product.resellerPercent, flash);
  const totalDiscount = (unitPrice - eff.price) * quantity;
  // Attribute the cut to whichever price won so reseller/flash reporting stays accurate.
  const flashDiscount = eff.isFlash ? totalDiscount : 0;
  const resellerDiscount = eff.isFlash ? 0 : totalDiscount;
  const afterReseller = subtotal - totalDiscount;

  let discount = 0;
  let couponId: string | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon) return { error: "Kupon tidak ditemukan." };
    const evalResult = evaluateCoupon(coupon, afterReseller);
    if (!evalResult.ok) return { error: evalResult.reason };
    discount = evalResult.discount;
    couponId = coupon.id;
  }

  const total = afterReseller - discount;
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user.id,
      productId: product.id,
      variantId,
      variantName,
      quantity,
      subtotal,
      resellerDiscount,
      flashDiscount,
      discount,
      total,
      payMethod: "GATEWAY", // placeholder; updated to the method actually used at payment
      couponId,
      status: "PENDING",
      expiresAt: orderExpiryDate(),
    },
  });

  redirect(`/dashboard/orders/${order.id}`);
}

/**
 * Create an order. Logged-in users go straight through. Guests must verify their
 * email first: this START step validates the order + captcha and emails a 6-digit
 * code; the account + order are only created in verifyGuestCheckoutAction.
 */
export async function createOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await getCurrentUser();
  if (user) return createOrderForUser(user, formData);

  // --- Guest checkout START (no session) ---
  const r = await resolveOrderRequest(formData);
  if (!r.ok) return { error: r.error };

  const guestEmail = String(formData.get("guestEmail") ?? "").toLowerCase().trim();
  if (!z.string().email().safeParse(guestEmail).success) {
    return { error: "Masukkan email yang valid untuk checkout." };
  }
  const guestPhoneRaw = String(formData.get("guestPhone") ?? "").trim();
  let guestPhone: string | null = null;
  if (guestPhoneRaw) {
    guestPhone = normalizePhoneID(guestPhoneRaw);
    if (!guestPhone) return { error: "Nomor WhatsApp tidak valid (contoh: 0812xxxx)." };
  }

  const ip = await clientIp();
  const captchaOk = await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip);
  if (!captchaOk) return { error: "Verifikasi captcha gagal. Coba lagi." };
  if (
    !rateLimit(`guest:ip:${ip}`, 6, 60 * 60_000) ||
    !rateLimit(`reg:email:${guestEmail}`, 4, 10 * 60_000)
  ) {
    return { error: "Terlalu banyak permintaan. Coba lagi nanti atau login dulu." };
  }

  const existing = await prisma.user.findUnique({ where: { email: guestEmail } });
  if (existing) {
    return { error: "Email ini sudah punya akun. Silakan login dulu untuk lanjut checkout." };
  }
  // Don't clobber an in-progress manual registration for this email.
  const pending = await prisma.emailVerification.findUnique({ where: { email: guestEmail } });
  if (pending && pending.kind === "register" && pending.expiresAt > new Date()) {
    return { error: "Email ini sedang didaftarkan. Selesaikan verifikasi atau login dulu." };
  }

  const code = randomOtp();
  const evData = {
    kind: "guest",
    name: guestEmail.split("@")[0].slice(0, 40) || "Tamu",
    passwordHash: null as string | null,
    phone: guestPhone,
    codeHash: await hashPassword(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
    attempts: 0,
  };
  await prisma.emailVerification.upsert({
    where: { email: guestEmail },
    create: { email: guestEmail, ...evData },
    update: evData,
  });
  await notifyEmailVerification({ email: guestEmail, code, minutes: OTP_TTL_MIN });
  return { step: "verify", email: guestEmail };
}

/** Guest checkout step 2: verify the code, create the account + order, sign in. */
export async function verifyGuestCheckoutAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const code = String(formData.get("code") ?? "").trim();

  const result = await verifyOtp(email, code, "guest");
  if (!result.ok) return result.state;
  const pending = result.pending;

  const dupe = await prisma.user.findUnique({ where: { email } });
  if (dupe) {
    await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
    return { error: "Email ini sudah punya akun. Silakan login dulu." };
  }

  const plainPassword = randomPassword();
  const signupIp = await clientIp();
  const created = await prisma.user
    .create({
      data: {
        email,
        name: pending.name,
        phone: pending.phone,
        password: await hashPassword(plainPassword),
        role: "USER",
        isGuest: true,
        signupIp: signupIp === "unknown" ? null : signupIp,
      },
    })
    .catch(() => null);
  if (!created) return { error: "Email ini sudah punya akun. Silakan login dulu." };

  await attachReferralFromCookie(created.id); // guest came via /r/<code> -> record the referral
  await prisma.emailVerification.delete({ where: { email } }).catch(() => {});
  await createSession(created.id, created.role);
  await notifyAccountCreated({
    userId: created.id,
    email: created.email,
    phone: created.phone,
    name: created.name,
    password: plainPassword,
  }).catch(() => {});

  // Now place the order under the freshly-created account (redirects on success).
  const orderResult = await createOrderForUser(created, formData);
  // createOrderForUser only RETURNS when order creation failed (e.g. the stock
  // sold out during the OTP window). The buyer is already signed in, so bounce
  // them back to the product page (as a member) rather than stranding them on the
  // now-dead verification screen.
  if (orderResult?.error) {
    const p = await prisma.product.findUnique({
      where: { id: String(formData.get("productId") ?? "") },
      select: { slug: true },
    });
    redirect(p ? `/produk/${p.slug}` : "/dashboard");
  }
  return orderResult;
}

/**
 * Pay an order instantly: used for balance payments (any mode) and for
 * gateway payments while in simulation mode. Real-gateway orders use
 * startOrderGatewayAction + the webhook instead.
 */
export async function payOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) {
    return { error: "Pesanan tidak ditemukan." };
  }
  if (order.status !== "PENDING") {
    return { error: "Pesanan ini sudah diproses." };
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
    return { error: "Batas waktu pembayaran sudah lewat. Pesanan dibatalkan." };
  }

  // Method chosen at the checkout page.
  const method = String(formData.get("method") ?? "GATEWAY") === "BALANCE" ? "BALANCE" : "GATEWAY";
  const useBalance = method === "BALANCE";
  // Real gateway with a payable total must go through the gateway flow.
  if (!useBalance && order.total > 0 && !isSimulation()) {
    return { error: "Silakan lanjutkan ke pembayaran gateway." };
  }

  const paymentRef = useBalance ? "BALANCE" : `SIM-${Date.now()}`;

  try {
    await settleOrderTransaction(order.id, { useBalance, paymentRef, payMethod: method });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INSUFFICIENT_BALANCE") {
      return { error: "Saldo tidak cukup. Top up dulu, ya." };
    }
    if (msg === "OUT_OF_STOCK") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return { error: "Maaf, stok baru saja habis. Pesanan dibatalkan." };
    }
    if (msg === "COUPON_EXHAUSTED" || msg === "COUPON_INVALID") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return { error: "Kupon sudah tidak berlaku. Silakan buat pesanan baru." };
    }
    if (msg === "ALREADY_PROCESSED") {
      return { error: "Pesanan ini sudah diproses." };
    }
    throw e;
  }

  // Fire-and-forget notifications — never break checkout. Each guards on the
  // order's status internally, so only the matching one actually sends:
  // COMPLETED (auto delivered) vs PAID (manual, awaiting admin delivery).
  try {
    await notifyOrderCompleted(order.id);
    await notifyOrderPaid(order.id);
    await notifyAdminNewOrder(order.id);
  } catch (e) {
    console.error("[notify] order paid/completed failed", e);
  }

  // Referral reward fires on the buyer's FIRST completed order (idempotent).
  processReferralReward(order.id);

  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/orders/${order.id}?success=1`);
}
