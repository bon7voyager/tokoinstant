import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import NotificationStatusBadge from "@/components/NotificationStatusBadge";
import { resendNotificationAction } from "@/app/actions/notifications";
import { notifyStatus } from "@/lib/notify";
import { formatDate, cn } from "@/lib/utils";
import Pagination from "@/components/Pagination";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const CHANNEL_FILTERS = ["ALL", "EMAIL", "WHATSAPP"] as const;
const STATUS_FILTERS = ["ALL", "SENT", "FAILED", "LOGGED"] as const;
const PAGE_SIZE = 10;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; page?: string }>;
}) {
  const { channel, status, page: pageRaw } = await searchParams;
  const cfg = notifyStatus();

  const where: { channel?: NotificationChannel; status?: NotificationStatus } = {};
  if (channel && channel !== "ALL") where.channel = channel as NotificationChannel;
  if (status && status !== "ALL") where.status = status as NotificationStatus;

  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const items = await prisma.notification.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const baseHref = `/admin/notifications?channel=${channel ?? "ALL"}&status=${status ?? "ALL"}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Notifikasi</h1>
      <p className="font-medium text-ink/60">Log email & WhatsApp yang dikirim sistem.</p>

      {/* Provider status */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="border-3 border-ink bg-white px-3 py-1 font-bold shadow-brutal-sm">
          Email: {cfg.email ?? "LOG saja"}
        </span>
        <span className="border-3 border-ink bg-white px-3 py-1 font-bold shadow-brutal-sm">
          WhatsApp: {cfg.whatsapp ?? "LOG saja"}
        </span>
        <span className="border-3 border-ink bg-white px-3 py-1 font-bold shadow-brutal-sm">
          Mode body: {cfg.logBody}
        </span>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-2">
        {CHANNEL_FILTERS.map((c) => (
          <Link
            key={c}
            href={`/admin/notifications?channel=${c}&status=${status ?? "ALL"}`}
            className={cn(
              "border-3 border-ink px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm",
              (channel ?? "ALL") === c ? "bg-main" : "bg-white",
            )}
          >
            {c === "ALL" ? "Semua Channel" : c}
          </Link>
        ))}
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`/admin/notifications?channel=${channel ?? "ALL"}&status=${s}`}
            className={cn(
              "border-3 border-ink px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm",
              (status ?? "ALL") === s ? "bg-accent" : "bg-white",
            )}
          >
            {s === "ALL" ? "Semua Status" : s}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Tujuan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada notifikasi.
                </td>
              </tr>
            ) : (
              items.map((n) => (
                <tr key={n.id} className="border-b border-ink/10 last:border-0 align-top">
                  <td className="px-4 py-3 text-xs text-ink/60">{formatDate(n.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={n.channel === "EMAIL" ? "accent" : "lime"}>
                      {n.channel === "EMAIL" ? "Email" : "WA"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{n.template}</td>
                  <td className="px-4 py-3 text-xs">{n.to}</td>
                  <td className="px-4 py-3">
                    <NotificationStatusBadge status={n.status} />
                    {n.error && (
                      <div className="mt-1 text-xs text-secondary">{n.error}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{n.provider ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {n.orderId && n.template === "order_completed" && (
                      <form action={resendNotificationAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button className="border-3 border-ink bg-white px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                          Kirim ulang
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
    </div>
  );
}
