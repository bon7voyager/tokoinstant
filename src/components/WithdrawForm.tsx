"use client";

import { useActionState, useState } from "react";
import { requestWithdrawalAction } from "@/app/actions/withdrawals";
import { Button, Input, Label, Select, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

export default function WithdrawForm({
  balance,
  min,
}: {
  balance: number;
  min: number;
}) {
  const [state, formAction, pending] = useActionState(requestWithdrawalAction, undefined);
  const [amount, setAmount] = useState<number>(Math.min(balance, min));

  const tooLow = amount < min;
  const tooHigh = amount > balance;

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="amount">Nominal Penarikan</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min={min}
          max={balance}
          step={1000}
          value={Number.isFinite(amount) ? amount : ""}
          onChange={(e) => setAmount(Math.floor(Number(e.target.value)))}
          required
        />
        <p className="mt-1 text-xs font-medium text-ink/50">
          Min {formatIDR(min)} · Saldo tersedia {formatIDR(balance)}
        </p>
      </div>

      <div>
        <Label htmlFor="method">Tujuan</Label>
        <Select id="method" name="method" defaultValue="BANK">
          <option value="BANK">Transfer Bank</option>
          <option value="EWALLET">E-Wallet (DANA/OVO/GoPay/dll)</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="accountName">Nama Pemilik</Label>
          <Input id="accountName" name="accountName" placeholder="Nama sesuai rekening" required />
        </div>
        <div>
          <Label htmlFor="accountNumber">No. Rekening / E-Wallet</Label>
          <Input id="accountNumber" name="accountNumber" placeholder="08xx / 1234567890" required />
        </div>
      </div>

      <div>
        <Label htmlFor="note">Catatan (opsional)</Label>
        <Input id="note" name="note" placeholder="mis. nama bank: BCA" />
      </div>

      <div className="flex items-center justify-between border-3 border-ink bg-paper px-4 py-3">
        <span className="font-bold uppercase">Ditarik</span>
        <span className="font-display text-2xl">{formatIDR(amount || 0)}</span>
      </div>

      <Button
        type="submit"
        size="lg"
        variant="secondary"
        className="w-full"
        disabled={pending || tooLow || tooHigh || balance < min}
      >
        {pending ? "Memproses..." : "Ajukan Penarikan"}
      </Button>
      <p className="text-center text-xs font-medium text-ink/50">
        Saldo langsung ditahan saat diajukan. Dana ditransfer setelah disetujui admin
        (ditolak = saldo dikembalikan).
      </p>
    </form>
  );
}
