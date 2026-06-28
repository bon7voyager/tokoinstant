"use client";

import { useActionState } from "react";
import { refundOrderAction, replaceOrderStockAction } from "@/app/actions/refunds";
import { Button, Input, Label, Alert } from "@/components/ui";

export default function AdminOrderActions({
  orderId,
  canWarranty = true,
}: {
  orderId: string;
  canWarranty?: boolean;
}) {
  const [refundState, refundAction, refundPending] = useActionState(refundOrderAction, undefined);
  const [warrantyState, warrantyAction, warrantyPending] = useActionState(
    replaceOrderStockAction,
    undefined,
  );

  return (
    <div className={`grid gap-5 ${canWarranty ? "md:grid-cols-2" : ""}`}>
      {/* Refund */}
      <div className="border-3 border-ink bg-white p-5 shadow-brutal">
        <h3 className="font-display text-lg">↩️ Refund</h3>
        <p className="mb-3 mt-1 text-sm text-ink/60">
          Kembalikan dana ke <b>saldo</b> pembeli & tandai pesanan sebagai Refund.
        </p>
        <form action={refundAction} className="space-y-2">
          <input type="hidden" name="orderId" value={orderId} />
          {refundState?.error && <Alert tone="error">{refundState.error}</Alert>}
          {refundState?.success && <Alert tone="success">{refundState.success}</Alert>}
          <Label htmlFor="refund-reason">Alasan</Label>
          <Input id="refund-reason" name="reason" placeholder="mis. akun tidak bisa dipakai" />
          <Button
            type="submit"
            variant="secondary"
            disabled={refundPending}
            onClick={(e) => {
              if (!confirm("Refund pesanan ini? Dana dikembalikan ke saldo pembeli.")) e.preventDefault();
            }}
          >
            {refundPending ? "Memproses..." : "Refund ke Saldo"}
          </Button>
        </form>
      </div>

      {/* Warranty (only for auto/stock products) */}
      {canWarranty && (
      <div className="border-3 border-ink bg-white p-5 shadow-brutal">
        <h3 className="font-display text-lg">🛡️ Garansi (Ganti Akun)</h3>
        <p className="mb-3 mt-1 text-sm text-ink/60">
          Kirim akun <b>pengganti</b> dari stok tanpa biaya tambahan.
        </p>
        <form action={warrantyAction} className="space-y-2">
          <input type="hidden" name="orderId" value={orderId} />
          {warrantyState?.error && <Alert tone="error">{warrantyState.error}</Alert>}
          {warrantyState?.success && <Alert tone="success">{warrantyState.success}</Alert>}
          <Label htmlFor="warranty-reason">Alasan</Label>
          <Input id="warranty-reason" name="reason" placeholder="mis. akun ke-logout" />
          <Button
            type="submit"
            variant="lime"
            disabled={warrantyPending}
            onClick={(e) => {
              if (!confirm("Kirim akun pengganti dari stok untuk pesanan ini?")) e.preventDefault();
            }}
          >
            {warrantyPending ? "Memproses..." : "Kirim Akun Pengganti"}
          </Button>
        </form>
      </div>
      )}
    </div>
  );
}
