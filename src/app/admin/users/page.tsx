import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Input, Button } from "@/components/ui";
import DeleteUserButton from "@/components/DeleteUserButton";
import { isPremium } from "@/lib/membership";
import { formatIDR, formatDate } from "@/lib/utils";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageRaw } = await searchParams;
  const term = (q ?? "").trim();

  const where = term
    ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] }
    : {};

  const [admin, total] = await Promise.all([
    getCurrentUser(),
    prisma.user.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      orders: { where: { status: "COMPLETED" }, select: { total: true } },
      _count: { select: { orders: true } },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const baseHref = `/admin/users${term ? `?q=${encodeURIComponent(term)}` : ""}`;

  return (
    <div>
      <h1 className="font-display text-3xl">Pengguna</h1>
      <p className="font-medium text-ink/60">Daftar semua akun terdaftar.</p>

      {/* Search */}
      <form className="mt-5 flex gap-2" action="/admin/users" method="get">
        <Input
          name="q"
          defaultValue={term}
          placeholder="Cari nama atau email…"
          className="max-w-sm"
        />
        <Button type="submit" variant="ink" size="sm">
          Cari
        </Button>
      </form>
      {term && (
        <p className="mt-2 text-sm font-medium text-ink/50">
          {total} hasil untuk “{term}”.{" "}
          <Link href="/admin/users" className="brutal-link">
            Reset
          </Link>
        </p>
      )}

      <div className="mt-5 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Pesanan</th>
              <th className="px-4 py-3">Total Belanja</th>
              <th className="px-4 py-3">Daftar</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-medium text-ink/50">
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const spent = u.orders.reduce((sum, o) => sum + o.total, 0);
              return (
                <tr key={u.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-bold">{u.name}</div>
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.role === "ADMIN" ? (
                        <Badge variant="grape">Admin</Badge>
                      ) : isPremium(u) ? (
                        <Badge variant="lime">💎 Reseller</Badge>
                      ) : (
                        <Badge variant="white">User</Badge>
                      )}
                      {u.isGuest && <Badge variant="white">👤 Tamu</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{u._count.orders}</td>
                  <td className="px-4 py-3 font-bold">{formatIDR(spent)}</td>
                  <td className="px-4 py-3 text-xs text-ink/60">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-nowrap items-center justify-end gap-1.5">
                      <Link
                        href={`/admin/users/${u.id}/transactions`}
                        className="shrink-0 whitespace-nowrap border-3 border-ink bg-bubble px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm"
                        title="Lihat riwayat transaksi pengguna ini"
                      >
                        Riwayat
                      </Link>
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="shrink-0 whitespace-nowrap border-3 border-ink bg-accent px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm"
                      >
                        Edit
                      </Link>
                      {u.role === "USER" && u.id !== admin?.id && (
                        <DeleteUserButton id={u.id} name={u.name} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
    </div>
  );
}
