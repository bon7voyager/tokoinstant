import "server-only";
import { prisma } from "@/lib/prisma";

export type TxnStatus = "PENDING" | "SUCCESS" | "FAILED";
export type RecentTxn = {
  date: string; // "26-06-2026 19:24:39"
  invoice: string; // full invoice number (no sensitive data in it)
  product: string; // product (+ variant) bought
  price: string; // full price, e.g. IDR 16.200
  status: TxnStatus;
};

const pad = (n: number) => String(n).padStart(2, "0");
function fmtDateTime(d: Date): string {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatPrice(total: number): string {
  return `IDR ${Math.max(0, Math.round(total)).toLocaleString("id-ID")}`;
}
function mapStatus(s: string): TxnStatus {
  if (s === "COMPLETED") return "SUCCESS";
  if (s === "PENDING" || s === "PAID") return "PENDING";
  return "FAILED"; // FAILED / EXPIRED / REFUNDED
}

/**
 * Recent PRODUCT transactions for the public "real-time" feed. Shows the full
 * invoice + product (non-sensitive, builds trust) but never the buyer's identity
 * (no name/email/phone) or credentials. Membership purchases are not included.
 */
export async function getRecentTransactions(limit = 10): Promise<RecentTxn[]> {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      variantName: true,
      product: { select: { name: true } },
    },
  });
  return orders.map((o) => ({
    date: fmtDateTime(o.createdAt),
    invoice: o.orderNumber,
    product: o.product.name + (o.variantName ? ` — ${o.variantName}` : ""),
    price: formatPrice(o.total),
    status: mapStatus(o.status),
  }));
}
