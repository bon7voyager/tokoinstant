"use client";

import { useActionState } from "react";
import { payOrderAction } from "@/app/actions/orders";
import { Button, Alert } from "@/components/ui";

export default function PayForm({
  orderId,
  method = "GATEWAY",
  label = "💳 Bayar Sekarang",
}: {
  orderId: string;
  method?: "GATEWAY" | "BALANCE";
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(payOrderAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="method" value={method} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Button
        type="submit"
        size="lg"
        variant="secondary"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Memproses pembayaran..." : label}
      </Button>
    </form>
  );
}
