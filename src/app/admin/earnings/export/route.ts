import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isEarningsRange, rangeWindowStart, type EarningsRange } from "@/lib/earnings";

export const dynamic = "force-dynamic";

const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const fmtDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const raw = req.nextUrl.searchParams.get("range") ?? "";
  const range: EarningsRange = isEarningsRange(raw) ? raw : "bulanan";
  const start = rangeWindowStart(range);
  const inRange = (d: Date) => !start || d.getTime() >= start.getTime();

  const [orders, memberships] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["COMPLETED", "PAID"] } },
      select: {
        orderNumber: true,
        total: true,
        quantity: true,
        paidAt: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.membershipPurchase.findMany({
      where: { status: "PAID" },
      select: { amount: true, paidAt: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  type Row = { at: Date; tipe: string; item: string; ref: string; qty: number; total: number };
  const rows: Row[] = [];
  for (const o of orders) {
    const at = o.paidAt ?? o.createdAt;
    if (inRange(at))
      rows.push({ at, tipe: "Produk", item: o.product?.name ?? "Produk", ref: o.orderNumber, qty: o.quantity, total: o.total });
  }
  for (const m of memberships) {
    const at = m.paidAt ?? m.createdAt;
    if (inRange(at))
      rows.push({ at, tipe: "Membership", item: "Membership Reseller", ref: m.user?.name ?? "", qty: 1, total: m.amount });
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());

  const header = ["Tanggal", "Tipe", "Item", "Ref", "Qty", "Total"].join(",");
  const body = rows.map((r) => [fmtDate(r.at), r.tipe, esc(r.item), esc(r.ref), r.qty, r.total].join(","));
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const csv = ["﻿" + header, ...body, "", `Total,,,,,${grand}`].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="penghasilan-${range}-${stamp}.csv"`,
    },
  });
}
