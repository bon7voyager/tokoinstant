import { Badge } from "@/components/ui";
import type { NotificationStatus } from "@prisma/client";

const MAP: Record<NotificationStatus, { label: string; variant: "lime" | "secondary" | "accent" }> = {
  SENT: { label: "Terkirim", variant: "lime" },
  FAILED: { label: "Gagal", variant: "secondary" },
  LOGGED: { label: "Tercatat", variant: "accent" },
};

export default function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  const s = MAP[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
