"use client";

import { useActionState } from "react";
import Link from "next/link";
import { payOrderAction } from "@/app/actions/orders";
import { startOrderGatewayAction } from "@/app/actions/payments";
import { Button, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

/**
 * Checkout payment chooser: pay with website balance, or pay directly via the
 * gateway. In simulation mode the gateway button settles instantly; with a real
 * provider it starts the hosted-payment flow.
 */
export default function CheckoutOptions({
  orderId,
  total,
  balance,
  simulation,
}: {
  orderId: string;
  total: number;
  balance: number;
  simulation: boolean;
}) {
  const [balState, balAction, balPending] = useActionState(payOrderAction, undefined);
  const [gwState, gwAction, gwPending] = useActionState(
    simulation ? payOrderAction : startOrderGatewayAction,
    undefined,
  );

  const insufficient = balance < total;
  // gwAction may be payOrderAction (no instruction) or startOrderGatewayAction (has it).
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
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="method" value="BALANCE" />
          <Button
            type="submit"
            size="lg"
            variant="grape"
            className="w-full"
            disabled={insufficient || balPending}
          >
            {balPending ? "Memproses..." : `Bayar ${formatIDR(total)} pakai Saldo`}
          </Button>
        </form>
        {insufficient && (
          <p className="mt-2 text-center text-sm font-bold text-secondary">
            Saldo kurang.{" "}
            <Link href="/dashboard/topup" className="brutal-link">
              Top up dulu →
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
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="method" value="GATEWAY" />
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
            Mode simulasi: langsung dianggap lunas & akun dikirim otomatis.
          </p>
        )}
      </div>
    </div>
  );
}
