"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { trackOrderAction } from "@/app/actions/track";
import { Button, Input, Label, Alert } from "@/components/ui";
import OrderStatusBadge from "@/components/OrderStatus";
import { formatIDR, formatDate } from "@/lib/utils";

const STATUS_DESC: Record<string, string> = {
  PENDING: "Menunggu pembayaran.",
  PAID: "Pembayaran diterima — sedang diproses admin.",
  COMPLETED: "Selesai — produk sudah dikirim.",
  FAILED: "Pesanan gagal diproses.",
  EXPIRED: "Dibatalkan karena melewati batas waktu pembayaran.",
  REFUNDED: "Pesanan telah direfund.",
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink/60">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

export default function TrackForm() {
  const [state, action, pending] = useActionState(trackOrderAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const invoiceRef = useRef<HTMLInputElement>(null);
  const order = state?.order;
  const live = !!order && (order.status === "PENDING" || order.status === "PAID");

  // Clicking an invoice in the real-time table lands here with ?invoice=… —
  // prefill and look it up automatically.
  const invoiceParam = useSearchParams().get("invoice");
  useEffect(() => {
    if (invoiceParam && invoiceRef.current) {
      invoiceRef.current.value = invoiceParam;
      formRef.current?.requestSubmit();
    }
  }, [invoiceParam]);

  // React 19 resets the form after each action, so re-fill the invoice box with
  // the looked-up order — keeps it visible AND lets the auto-refresh resubmit it.
  useEffect(() => {
    if (order && invoiceRef.current) invoiceRef.current.value = order.orderNumber;
  }, [order?.orderNumber]);

  // Auto-refresh status while the order is still in a non-terminal state.
  // 30s keeps it well under the per-IP tracker rate limit even on a long-open tab.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => formRef.current?.requestSubmit(), 30000);
    return () => clearInterval(t);
  }, [live, order?.orderNumber, order?.status]);

  return (
    <div className="space-y-5">
      <form ref={formRef} action={action} className="space-y-4">
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <div>
          <Label htmlFor="invoice">Cari detail pembelian kamu di sini</Label>
          <Input
            ref={invoiceRef}
            id="invoice"
            name="invoice"
            placeholder="Masukkan nomor Invoice (contoh: INV-20260101-XXXXXX)"
            className="uppercase"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Mencari..." : "🔎 Cari Invoice"}
        </Button>
      </form>

      {order && (
        <div className="border-3 border-ink bg-white p-6 shadow-brutal">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display text-xl">
                {order.productName}
                {order.variantName && <span className="text-ink/60"> — {order.variantName}</span>}
              </div>
              <div className="font-mono text-sm text-ink/50">{order.orderNumber}</div>
            </div>
            <OrderStatusBadge status={order.status as OrderStatus} />
          </div>

          <p className="mt-3 text-sm font-medium text-ink/70">{STATUS_DESC[order.status] ?? ""}</p>

          <dl className="mt-4 space-y-1.5 border-t-3 border-ink pt-3 text-sm">
            <Row k="Jumlah" v={`${order.quantity} item`} />
            <Row k="Total" v={formatIDR(order.total)} />
            <Row k="Dibuat" v={formatDate(new Date(order.createdAt))} />
            {order.paidAt && <Row k="Dibayar" v={formatDate(new Date(order.paidAt))} />}
            {order.completedAt && <Row k="Selesai" v={formatDate(new Date(order.completedAt))} />}
          </dl>

          {live && (
            <p className="mt-3 text-xs font-medium text-ink/50">
              🔄 Status diperbarui otomatis tiap 15 detik.
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-ink/50">
            Detail akun/produk dikirim ke email kamu & tersedia di dashboard (login untuk melihat).
          </p>
        </div>
      )}
    </div>
  );
}
