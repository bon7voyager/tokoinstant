import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isSimulation } from "@/lib/payment";
import { isPremium, premiumConfig } from "@/lib/membership";
import { Badge } from "@/components/ui";
import MembershipCheckout from "@/components/MembershipCheckout";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MembershipPayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/upgrade");

  const purchase = await prisma.membershipPurchase.findUnique({ where: { id } });
  if (!purchase || purchase.userId !== user.id) notFound();
  if (purchase.status === "PAID") redirect("/dashboard/upgrade?success=1");
  // Already a reseller (paid elsewhere / admin-granted) -> nothing to pay.
  if (isPremium(user)) redirect("/dashboard/upgrade");
  // FAILED / EXPIRED (e.g. a real-gateway charge that lapsed) -> no dead-end;
  // send the user back to start a fresh upgrade.
  if (purchase.status !== "PENDING") redirect("/dashboard/upgrade");

  const sim = isSimulation();
  const { percent } = premiumConfig();
  const pending = purchase.status === "PENDING";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard/upgrade" className="brutal-link text-sm">
        ← Kembali
      </Link>

      <div className="mt-5 border-3 border-ink bg-grape p-6 text-white shadow-brutal-lg">
        <Badge variant="white">Konfirmasi Pembelian</Badge>
        <h1 className="mt-3 font-display text-2xl">Member Reseller (Premium)</h1>
        <p className="mt-1 font-medium text-white/90">
          Diskon {percent}% · berlaku {purchase.days} hari
        </p>
      </div>

      <div className="mt-5 border-3 border-ink bg-white p-6 shadow-brutal">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/60">Paket</dt>
            <dd className="font-medium">Reseller {purchase.days} hari</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">Diskon</dt>
            <dd className="font-medium">{percent}% semua produk</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">Dibuat</dt>
            <dd className="font-medium">{formatDate(purchase.createdAt)}</dd>
          </div>
          <div className="flex justify-between border-t-3 border-ink pt-2">
            <dt className="font-bold uppercase">Total</dt>
            <dd className="font-display text-lg">{formatIDR(purchase.amount)}</dd>
          </div>
        </dl>
      </div>

      {pending && (
        <div className="mt-5 border-3 border-ink bg-main p-6 shadow-brutal">
          <h2 className="font-display text-xl">Pilih Metode Pembayaran</h2>
          <p className="mt-1 mb-4 text-sm font-medium text-ink/70">
            Bayar pakai <strong>saldo</strong>, atau <strong>langsung</strong> lewat
            pembayaran kalau saldo nggak cukup. Total{" "}
            <strong>{formatIDR(purchase.amount)}</strong>.
          </p>
          <MembershipCheckout
            purchaseId={purchase.id}
            amount={purchase.amount}
            balance={user.balance}
            simulation={sim}
          />
        </div>
      )}
    </div>
  );
}
