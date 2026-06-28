"use client";

import { useActionState } from "react";
import { requestMembershipUpgradeAction } from "@/app/actions/membership";
import { Button, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export default function UpgradeForm({
  fee,
  balance,
}: {
  fee: number;
  balance: number;
}) {
  const [state, formAction, pending] = useActionState(
    requestMembershipUpgradeAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div className="flex items-center justify-between border-3 border-ink bg-paper px-4 py-3">
        <span className="font-bold uppercase">Biaya Upgrade</span>
        <span className="font-display text-2xl">{formatIDR(fee)}</span>
      </div>
      <p className="text-xs font-medium text-ink/50">
        Saldo kamu: {formatIDR(balance)}. Metode pembayaran (saldo / bayar langsung)
        dipilih di langkah berikutnya — belum ada yang dipotong sekarang.
      </p>

      <Button type="submit" size="lg" variant="grape" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : "Lanjut ke Pembayaran →"}
      </Button>
    </form>
  );
}
