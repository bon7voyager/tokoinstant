import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isPremium } from "@/lib/membership";
import { buttonStyles, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import ResellerApiPanel from "@/components/ResellerApiPanel";
import ResellerApiDocs from "@/components/ResellerApiDocs";

export const dynamic = "force-dynamic";

export default async function ResellerApiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/api");

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  if (!isPremium(user)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="border-3 border-ink bg-white p-8 text-center shadow-brutal">
          <div className="font-display text-5xl">⚡</div>
          <h1 className="mt-3 font-display text-3xl">API Reseller</h1>
          <p className="mx-auto mt-2 max-w-md font-medium text-ink/60">
            Jualan produk Kilat di website kamu sendiri — ambil stok/akun otomatis lewat API.
            Fitur ini khusus <b>member reseller aktif</b>.
          </p>
          <Link href="/dashboard/upgrade" className={`${buttonStyles("ink", "lg")} mt-5`}>
            Jadi Reseller →
          </Link>
        </div>
      </div>
    );
  }

  const [keys, profile, logs] = await Promise.all([
    prisma.apiKey.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, prefix: true, lastUsedAt: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { apiCallbackUrl: true, apiCallbackSecret: true },
    }),
    prisma.apiCallbackLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const keyRows = keys.map((k) => ({
    id: k.id,
    label: k.label,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className="brutal-link text-sm">
          ← Kembali ke dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl">⚡ API Reseller</h1>
        <p className="font-medium text-ink/60">
          Integrasikan toko kamu: ambil produk, buat order (potong saldo / gateway), dan terima akun
          otomatis — semuanya dari API kami.
        </p>
      </div>

      <ResellerApiPanel
        keys={keyRows}
        callbackUrl={profile?.apiCallbackUrl ?? null}
        callbackSecret={profile?.apiCallbackSecret ?? null}
      />

      {/* Webhook delivery log */}
      <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
        <h2 className="font-display text-xl">📜 Riwayat Webhook</h2>
        <p className="mt-1 text-sm font-medium text-ink/60">
          Status pengiriman callback ke URL webhook kamu (15 terakhir).
        </p>
        {logs.length === 0 ? (
          <p className="mt-4 text-sm font-medium text-ink/50">
            Belum ada pengiriman webhook.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border-3 border-ink">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b-3 border-ink bg-paper">
                <tr className="font-bold uppercase">
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">HTTP</th>
                  <th className="px-3 py-2">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-ink/10 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{l.orderNumber}</td>
                    <td className="px-3 py-2">
                      <Badge variant={l.status === "SENT" ? "lime" : "secondary"}>
                        {l.status === "SENT" ? "Terkirim" : "Gagal"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.httpStatus ?? "—"}
                      {l.error && <span className="text-ink/40"> · {l.error}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink/60">
                      {formatDate(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResellerApiDocs baseUrl={baseUrl} />
    </div>
  );
}
