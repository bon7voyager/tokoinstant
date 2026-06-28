"use client";

import { useActionState } from "react";
import { adminAdjustBalanceAction } from "@/app/actions/wallet";
import { Input, Alert } from "@/components/ui";

export default function AdjustForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(adminAdjustBalanceAction, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone={state.tone ?? "success"}>{state.success}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Input
          name="amount"
          type="number"
          placeholder="± nominal"
          className="!py-1.5 w-32 !text-sm"
          required
        />
        <Input name="note" placeholder="Catatan" className="!py-1.5 flex-1 !text-sm" required />
        <button
          className="shrink-0 border-3 border-ink bg-grape px-3 py-1.5 text-sm font-bold uppercase text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          disabled={pending}
        >
          {pending ? "..." : "Set"}
        </button>
      </div>
      <p className="text-xs text-ink/50">
        Nominal positif = tambah saldo, negatif = kurangi.
      </p>
    </form>
  );
}
