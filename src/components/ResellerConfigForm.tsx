"use client";

import { useActionState } from "react";
import { saveResellerConfigAction } from "@/app/actions/reseller";
import { Button, Input, Alert } from "@/components/ui";

export default function ResellerConfigForm({
  initial,
}: {
  initial: { fee: number; days: number; percent: number };
}) {
  const [state, action, pending] = useActionState(saveResellerConfigAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Biaya Upgrade (Rp)</span>
          <Input type="number" name="PREMIUM_FEE" min={1} defaultValue={initial.fee} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Durasi (hari)</span>
          <Input type="number" name="PREMIUM_DAYS" min={1} defaultValue={initial.days} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Diskon Default (%)</span>
          <Input
            type="number"
            name="RESELLER_DISCOUNT_PERCENT"
            min={0}
            max={90}
            defaultValue={initial.percent}
          />
          <span className="mt-1 block text-xs font-medium text-ink/50">
            0–90. Dipakai produk yang tak punya diskon sendiri.
          </span>
        </label>
      </div>

      <Button type="submit" variant="grape" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Konfigurasi"}
      </Button>
    </form>
  );
}
