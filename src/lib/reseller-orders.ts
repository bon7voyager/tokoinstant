import "server-only";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { orderExpiryDate } from "@/lib/orders";
import { resellerPrice } from "@/lib/membership";
import { settleOrderTransaction } from "@/lib/order-settle";
import { getPaymentProvider, isSimulation } from "@/lib/payment";
import { fireResellerCallback } from "@/lib/reseller-callback";
import { processReferralReward } from "@/lib/referral";
import type { ResellerApiUser } from "@/lib/api-key";

export type ApiOrderView = {
  order_ref: string | null;
  order_number: string;
  status: string; // pending | processing | completed | failed | expired | refunded
  pay_method: string; // BALANCE | GATEWAY
  product: string;
  quantity: number;
  total: number;
  account: string | null; // delivered credential(s), present once completed
  created_at: string;
  payment?: {
    redirect_url?: string | null;
    qr_string?: string | null;
    qr_image_url?: string | null;
    pay_code?: string | null;
  };
};

const STATUS_OUT: Record<string, string> = {
  PENDING: "pending",
  PAID: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
  REFUNDED: "refunded",
};

/** Serialize an order for the API (account credentials included once delivered). */
export async function orderView(
  orderId: string,
  payment?: ApiOrderView["payment"],
): Promise<ApiOrderView | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { name: true } },
      deliveredStocks: { select: { secret: true } },
    },
  });
  if (!o) return null;
  return {
    order_ref: o.externalRef,
    order_number: o.orderNumber,
    status: STATUS_OUT[o.status] ?? o.status.toLowerCase(),
    pay_method: o.payMethod,
    product: o.product.name,
    quantity: o.quantity,
    total: o.total,
    account: o.deliveredStocks.length
      ? o.deliveredStocks.map((s) => s.secret).join("\n")
      : null,
    created_at: o.createdAt.toISOString(),
    ...(payment ? { payment } : {}),
  };
}

const STATUS_IN: Record<string, OrderStatus> = {
  pending: "PENDING",
  processing: "PAID",
  completed: "COMPLETED",
  failed: "FAILED",
  expired: "EXPIRED",
  refunded: "REFUNDED",
};

/** List a reseller's API orders, newest first. Keyset pagination by `cursor`
 * (the last order id); optional `status` filter (buyer-facing status word). */
export async function listApiOrders(
  userId: string,
  opts: { limit: number; status?: string | null; cursor?: string | null },
): Promise<{ orders: ApiOrderView[]; next_cursor: string | null }> {
  const where: Prisma.OrderWhereInput = { userId, source: "API" };
  const mapped = opts.status ? STATUS_IN[opts.status.toLowerCase()] : undefined;
  if (mapped) where.status = mapped;
  if (opts.cursor) {
    const cur = await prisma.order.findFirst({
      where: { id: opts.cursor, userId },
      select: { id: true, createdAt: true },
    });
    if (cur) {
      // Compound keyset (createdAt, id) so orders sharing the same millisecond
      // timestamp aren't silently skipped across pages.
      where.OR = [
        { createdAt: { lt: cur.createdAt } },
        { createdAt: cur.createdAt, id: { lt: cur.id } },
      ];
    }
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: opts.limit + 1,
    include: {
      product: { select: { name: true } },
      deliveredStocks: { select: { secret: true } },
    },
  });
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  const orders: ApiOrderView[] = page.map((o) => ({
    order_ref: o.externalRef,
    order_number: o.orderNumber,
    status: STATUS_OUT[o.status] ?? o.status.toLowerCase(),
    pay_method: o.payMethod,
    product: o.product.name,
    quantity: o.quantity,
    total: o.total,
    account: o.deliveredStocks.length
      ? o.deliveredStocks.map((s) => s.secret).join("\n")
      : null,
    created_at: o.createdAt.toISOString(),
  }));

  return { orders, next_cursor: hasMore ? page[page.length - 1].id : null };
}

type PlaceInput = {
  productSlug: string;
  variantId?: string | null;
  quantity: number;
  payMethod: "BALANCE" | "GATEWAY";
  refId: string;
};

export type PlaceResult =
  | { ok: false; status: number; code: string; message: string }
  | { ok: true; order: ApiOrderView };

const fail = (status: number, code: string, message: string): PlaceResult => ({
  ok: false,
  status,
  code,
  message,
});

/**
 * Create + (try to) pay an order on behalf of a reseller. Idempotent per
 * (reseller, ref_id). Balance/simulation orders settle synchronously; a real
 * gateway returns payment instructions and settles later via webhook.
 */
export async function placeApiOrder(
  user: ResellerApiUser,
  input: PlaceInput,
): Promise<PlaceResult> {
  const quantity = Math.max(1, Math.min(10, Math.trunc(input.quantity || 1)));

  // Idempotency — a repeated ref_id returns the original order, never a new one.
  const existing = await prisma.order.findFirst({
    where: { userId: user.id, externalRef: input.refId },
  });
  if (existing) {
    const v = await orderView(existing.id);
    return v ? { ok: true, order: v } : fail(500, "internal", "Order lookup failed.");
  }

  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
    include: { variants: { where: { isActive: true } } },
  });
  if (!product || !product.isActive) {
    return fail(404, "product_not_found", "Produk tidak ditemukan.");
  }

  let unitPrice = product.price;
  let variantId: string | null = null;
  let variantName: string | null = null;
  if (product.variants.length > 0) {
    const v = product.variants.find((x) => x.id === input.variantId);
    if (!v) return fail(400, "variant_required", "variant_id wajib untuk produk ini.");
    unitPrice = v.price;
    variantId = v.id;
    variantName = v.name;
  }

  if (product.fulfillment === "AUTO") {
    const avail = await prisma.stock.count({
      where: { productId: product.id, variantId, status: "AVAILABLE" },
    });
    if (avail < quantity) {
      return fail(409, "out_of_stock", avail === 0 ? "Stok habis." : `Stok tersisa ${avail}.`);
    }
  }

  const unitReseller = resellerPrice(unitPrice, true, product.resellerPercent);
  const subtotal = unitPrice * quantity;
  const resellerDiscount = (unitPrice - unitReseller) * quantity;
  const total = subtotal - resellerDiscount;

  let order;
  try {
    order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user.id,
        productId: product.id,
        variantId,
        variantName,
        quantity,
        subtotal,
        resellerDiscount,
        discount: 0,
        total,
        payMethod: input.payMethod,
        source: "API",
        externalRef: input.refId,
        status: "PENDING",
        expiresAt: orderExpiryDate(),
      },
    });
  } catch {
    // A concurrent request won the (userId, externalRef) unique — return that one.
    const dup = await prisma.order.findFirst({
      where: { userId: user.id, externalRef: input.refId },
    });
    if (dup) {
      const v = await orderView(dup.id);
      if (v) return { ok: true, order: v };
    }
    return fail(500, "internal", "Gagal membuat pesanan.");
  }

  const settleView = async (): Promise<PlaceResult> => {
    fireResellerCallback(order.id); // fire-and-forget (no-op if no callback url)
    processReferralReward(order.id); // reward referral on the buyer's first completed order
    const v = await orderView(order.id);
    return v ? { ok: true, order: v } : fail(500, "internal", "Order lookup failed.");
  };

  // --- Pay from balance ---
  if (input.payMethod === "BALANCE") {
    try {
      await settleOrderTransaction(order.id, {
        useBalance: true,
        paymentRef: `API-BAL-${order.orderNumber}`,
        payMethod: "BALANCE",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Unpaid order — remove it so the ref_id is free to retry after top up.
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      if (msg === "INSUFFICIENT_BALANCE")
        return fail(402, "insufficient_balance", "Saldo tidak cukup. Top up dulu.");
      if (msg === "OUT_OF_STOCK") return fail(409, "out_of_stock", "Stok habis.");
      return fail(500, "settle_failed", "Gagal memproses pesanan.");
    }
    return settleView();
  }

  // --- Pay via gateway ---
  if (isSimulation()) {
    // Simulation provider = instant settlement, no real charge.
    try {
      await settleOrderTransaction(order.id, {
        useBalance: false,
        paymentRef: `API-SIM-${order.orderNumber}`,
        payMethod: "GATEWAY",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "OUT_OF_STOCK") {
        await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }).catch(() => {});
        return fail(409, "out_of_stock", "Stok habis.");
      }
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
      return fail(500, "settle_failed", "Gagal memproses pesanan.");
    }
    return settleView();
  }

  // Real gateway: create a charge, return instructions, settle later via webhook.
  const provider = getPaymentProvider();
  let charge;
  try {
    charge = await provider.createCharge({
      purpose: "ORDER",
      merchantRef: order.orderNumber,
      amount: order.total,
      customer: { name: user.name, email: user.email, phone: user.phone },
      itemName: `Pesanan ${order.orderNumber}`,
    });
  } catch {
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    return fail(502, "gateway_error", "Gagal membuat transaksi pembayaran.");
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRef: charge.ref, expiresAt: orderExpiryDate() },
  });
  const v = await orderView(order.id, {
    redirect_url: charge.redirectUrl ?? null,
    qr_string: charge.qrString ?? null,
    qr_image_url: charge.qrImageUrl ?? null,
    pay_code: charge.payCode ?? null,
  });
  return v ? { ok: true, order: v } : fail(500, "internal", "Order lookup failed.");
}
