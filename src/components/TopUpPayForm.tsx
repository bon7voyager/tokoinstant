"use client";

import { useActionState } from "react";
import { payTopUpAction } from "@/app/actions/wallet";
import { Button, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export default function TopUpPayForm({
  topUpId,
  amount,
}: {
  topUpId: string;
  amount: number;
}) {
  const [state, formAction, pending] = useActionState(payTopUpAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="topUpId" value={topUpId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Memproses pembayaran..." : `💳 Bayar ${formatIDR(amount)} (Simulasi)`}
      </Button>
      <p className="text-center text-xs font-medium text-ink/50">
        Mode simulasi: setelah klik, pembayaran dianggap berhasil & saldo bertambah.
      </p>
    </form>
  );
}
