import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminUserForm from "@/components/AdminUserForm";
import AdjustForm from "@/components/AdjustForm";
import { Badge } from "@/components/ui";
import {
  adminGrantPremiumAction,
  adminRevokePremiumAction,
} from "@/app/actions/membership";
import { isPremium, premiumConfig } from "@/lib/membership";
import { formatDate, formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      premiumUntil: true,
      balance: true,
    },
  });
  if (!user) notFound();

  const memLogs = await prisma.membershipLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const premium = isPremium(user);
  const { days, percent } = premiumConfig();

  return (
    <div>
      <Link href="/admin/users" className="brutal-link text-sm">
        ← Kembali ke pengguna
      </Link>
      <h1 className="mt-4 font-display text-3xl">Edit Pengguna</h1>
      <p className="font-medium text-ink/60">{user.email}</p>

      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <AdminUserForm user={user} />
      </div>

      {/* Saldo — tambah / kurangi manual */}
      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Saldo</h2>
            <p className="mt-1 text-sm font-medium text-ink/60">
              Tambah atau kurangi saldo buyer secara manual.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase text-ink/50">Saldo Saat Ini</div>
            <div className="font-display text-2xl">{formatIDR(user.balance)}</div>
          </div>
        </div>
        <div className="mt-4">
          <AdjustForm userId={user.id} />
        </div>
        <p className="mt-2 text-xs font-medium text-ink/50">
          Tercatat sebagai “Penyesuaian” di mutasi saldo & log transaksi user.
        </p>
      </div>

      {/* Membership / Reseller */}
      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Membership Reseller</h2>
            <p className="mt-1 text-sm font-medium text-ink/60">
              {premium ? (
                <>
                  💎 Aktif s/d <b>{user.premiumUntil ? formatDate(user.premiumUntil) : "-"}</b>{" "}
                  (diskon {percent}%)
                </>
              ) : (
                <>Regular — belum reseller.</>
              )}
            </p>
          </div>
          {premium ? <Badge variant="lime">Reseller</Badge> : <Badge variant="white">Regular</Badge>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={adminGrantPremiumAction}>
            <input type="hidden" name="userId" value={user.id} />
            <button className="border-3 border-ink bg-grape px-4 py-2 text-sm font-bold uppercase text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
              {premium ? `Perpanjang +${days} hari` : `Aktifkan (+${days} hari)`}
            </button>
          </form>
          {premium && (
            <form action={adminRevokePremiumAction}>
              <input type="hidden" name="userId" value={user.id} />
              <button className="border-3 border-ink bg-white px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                Cabut
              </button>
            </form>
          )}
        </div>
        <p className="mt-2 text-xs font-medium text-ink/50">
          Memberi membership manual tidak memotong saldo user.
        </p>

        {memLogs.length > 0 && (
          <div className="mt-4 border-t-3 border-ink/10 pt-3">
            <div className="mb-2 text-xs font-bold uppercase text-ink/50">
              Riwayat Membership
            </div>
            <ul className="space-y-1.5 text-sm">
              {memLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant={l.action === "GRANT" ? "lime" : "secondary"}>
                      {l.action === "GRANT" ? `+${l.days ?? 0} hari` : "Dicabut"}
                    </Badge>
                    <span className="truncate text-ink/60">{l.note}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink/40">{formatDate(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
