"use client";

import { useActionState } from "react";
import { deliverManualOrderAction } from "@/app/actions/admin";
import { Button, Textarea, Input, Label, Alert } from "@/components/ui";

export default function ManualDeliverForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(deliverManualOrderAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="md-content">Detail Produk untuk Pembeli</Label>
        <Textarea
          id="md-content"
          name="content"
          rows={4}
          required
          placeholder={"email:password / kode voucher / link / instruksi\n(satu per baris)"}
          className="font-mono text-sm"
        />
      </div>
      <div>
        <Label htmlFor="md-note">Catatan (opsional)</Label>
        <Input id="md-note" name="note" placeholder="mis. Durasi 30 hari | jangan ganti password" />
      </div>
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Mengirim..." : "📨 Kirim ke Pembeli"}
      </Button>
    </form>
  );
}
