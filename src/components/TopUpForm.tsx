"use client";

import { useActionState, useState } from "react";
import { requestTopUpAction } from "@/app/actions/wallet";
import { Button, Input, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export default function TopUpForm({
  presets,
  min,
  max,
}: {
  presets: number[];
  min: number;
  max: number;
}) {
  const [state, formAction, pending] = useActionState(requestTopUpAction, undefined);
  const [amount, setAmount] = useState<number>(presets[0] ?? min);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="amount" value={amount} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">
          Pilih Nominal
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`border-3 border-ink px-2 py-3 text-sm font-bold shadow-brutal-sm ${amount === p ? "bg-main" : "bg-white"}`}
            >
              {formatIDR(p)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-bold uppercase tracking-wide">
          Atau nominal lain
        </span>
        <Input
          type="number"
          min={min}
          max={max}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(Math.floor(Number(e.target.value)))}
        />
        <p className="mt-1 text-xs font-medium text-ink/50">
          Min {formatIDR(min)} — Maks {formatIDR(max)}
        </p>
      </div>

      <div className="flex items-center justify-between border-3 border-ink bg-paper px-4 py-3">
        <span className="font-bold uppercase">Total Top Up</span>
        <span className="font-display text-2xl">{formatIDR(amount || 0)}</span>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : "Top Up Sekarang"}
      </Button>
    </form>
  );
}
