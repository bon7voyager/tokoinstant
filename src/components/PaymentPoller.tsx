"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { pollOrderStatusAction } from "@/app/actions/orders";

/**
 * Polls the order status while a gateway payment is pending. When the webhook
 * settles the order (COMPLETED/FAILED/etc), refreshes the page so the buyer
 * sees their delivered account without a manual reload.
 */
export default function PaymentPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const stopped = useRef(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 150; // ~10 minutes at 4s

    const id = setInterval(async () => {
      if (stopped.current) return;
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(id);
        return;
      }
      try {
        const res = await pollOrderStatusAction(orderId);
        if (res && res.status !== "PENDING") {
          stopped.current = true;
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // transient — keep polling
      }
    }, 4000);

    return () => clearInterval(id);
  }, [orderId, router]);

  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-bold text-ink/60">
      <span className="inline-block h-3 w-3 animate-spin border-2 border-ink border-t-transparent" />
      Menunggu konfirmasi pembayaran… halaman akan otomatis diperbarui.
    </p>
  );
}
