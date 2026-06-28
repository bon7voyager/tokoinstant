"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  payMembershipBalanceAction,
  payMembershipGatewayAction,
  startMembershipGatewayAction,
} from "@/app/actions/membership";
import { Button, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

/**
 * Membership payment chooser: pay the upfront fee from wallet balance, or pay
 * directly via the gateway (useful when balance is short). In simulation mode the
 * gateway button settles instantly; with a real provider it starts the hosted flow.
 */
export default function MembershipCheckout({
  purchaseId,
  amount,
  balance,
  simulation,
}: {
  purchaseId: string;
  amount: number;
  balance: number;
  simulation: boolean;
}) {
  const [balState, balAction, balPending] = useActionState(
    payMembershipBalanceAction,
    undefined,
  );
  const [gwState, gwAction, gwPending] = useActionState(
    simulation ? payMembershipGatewayAction : startMembershipGatewayAction,
    undefined,
  );

  const insufficient = balance < amount;
  const gwInstruction = (
    gwState as { instruction?: { qrImageUrl?: string | null } } | undefined
  )?.instruction;

  return (
    <div className="space-y-4">
      {/* Pay with balance */}
      <div className="border-3 border-ink bg-white p-4 shadow-brutal-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-lg">👛 Bayar pakai Saldo</span>
          <span className="text-sm font-bold text-ink/60">
            Saldo: {formatIDR(balance)}
          </span>
        </div>
        {balState?.error && (
          <div className="mb-2">
            <Alert tone="error">{balState.error}</Alert>
          </div>
        )}
        <form action={balAction}>
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <Button
            type="submit"
            size="lg"
            variant="grape"
            className="w-full"
            disabled={insufficient || balPending}
          >
            {balPending ? "Memproses..." : `Bayar ${formatIDR(amount)} pakai Saldo`}
          </Button>
        </form>
        {insufficient && (
          <p className="mt-2 text-center text-sm font-bold text-secondary">
            Saldo kurang — pakai <strong>Bayar Langsung</strong> di bawah, atau{" "}
            <Link href="/dashboard/topup" className="brutal-link">
              top up dulu →
            </Link>
          </p>
        )}
      </div>

      {/* Pay via gateway */}
      <div className="border-3 border-ink bg-white p-4 shadow-brutal-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-lg">💳 Bayar Langsung</span>
          <span className="text-sm font-bold text-ink/60">QRIS / e-wallet / VA</span>
        </div>
        {gwState?.error && (
          <div className="mb-2">
            <Alert tone="error">{gwState.error}</Alert>
          </div>
        )}
        {gwInstruction?.qrImageUrl && (
          <div className="mb-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gwInstruction.qrImageUrl} alt="QRIS" className="mx-auto h-44 w-44" />
          </div>
        )}
        <form action={gwAction}>
          <input type="hidden" name="purchaseId" value={purchaseId} />
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={gwPending}
          >
            {gwPending
              ? "Memproses..."
              : simulation
                ? "Bayar Sekarang (Simulasi)"
                : "Lanjutkan ke Pembayaran"}
          </Button>
        </form>
        {simulation && (
          <p className="mt-2 text-center text-xs font-medium text-ink/50">
            Mode simulasi: langsung dianggap lunas & membership aktif otomatis.
          </p>
        )}
      </div>
    </div>
  );
}
