import { Badge } from "@/components/ui";
import type { OrderStatus as Status } from "@prisma/client";

const MAP: Record<Status, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  PENDING: { label: "Menunggu Bayar", variant: "main" },
  PAID: { label: "Diproses", variant: "accent" },
  COMPLETED: { label: "Selesai", variant: "lime" },
  FAILED: { label: "Gagal", variant: "secondary" },
  EXPIRED: { label: "Kadaluarsa", variant: "white" },
  REFUNDED: { label: "Refund", variant: "grape" },
};

export default function OrderStatusBadge({ status }: { status: Status }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
