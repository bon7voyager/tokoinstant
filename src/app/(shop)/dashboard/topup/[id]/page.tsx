import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isSimulation } from "@/lib/payment";
import { Badge } from "@/components/ui";
import TopUpPayForm from "@/components/TopUpPayForm";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TopUpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/topup");

  const topUp = await prisma.topUp.findUnique({ where: { id } });
  if (!topUp || topUp.userId !== user.id) notFound();
  if (topUp.status === "PAID") redirect("/dashboard/topup?success=1");

  const sim = isSimulation();
  const pending = topUp.status === "PENDING";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard/topup" className="brutal-link text-sm">
        ← Kembali ke Top Up
      </Link>

      <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Top Up Saldo</h1>
            <p className="text-sm font-medium text-ink/50">ID: {topUp.id.slice(-8)}</p>
          </div>
          <Badge variant={pending ? "main" : "lime"}>
            {pending ? "Menunggu Bayar" : topUp.status}
          </Badge>
        </div>

        <div className="mt-5 flex items-center justify-between border-3 border-ink bg-paper px-4 py-3">
          <span className="font-bold uppercase">Nominal</span>
          <span className="font-display text-2xl">{formatIDR(topUp.amount)}</span>
        </div>
        <p className="mt-2 text-xs font-medium text-ink/50">{formatDate(topUp.createdAt)}</p>
      </div>

      {pending && (
        <div className="mt-5 border-3 border-ink bg-main p-6 shadow-brutal">
          <h2 className="font-display text-xl">Selesaikan Pembayaran</h2>

          {sim ? (
            <>
              <p className="mt-1 mb-4 text-sm font-medium text-ink/70">
                Scan QRIS di bawah, lalu tekan tombol bayar untuk menambah saldo.
              </p>
              <div className="mb-4 flex justify-center">
                <div className="grid h-40 w-40 grid-cols-8 gap-0.5 border-3 border-ink bg-white p-2">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={(i * 7 + (i % 5) + (i % 3)) % 2 === 0 ? "bg-ink" : "bg-white"}
                    />
                  ))}
                </div>
              </div>
              <TopUpPayForm topUpId={topUp.id} amount={topUp.amount} />
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-ink/70">
              Menunggu konfirmasi pembayaran dari gateway. Saldo akan bertambah
              otomatis setelah pembayaran lunas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
