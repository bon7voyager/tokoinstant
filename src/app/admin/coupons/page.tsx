import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import CouponForm from "@/components/CouponForm";
import Pagination from "@/components/Pagination";
import ConfirmButton from "@/components/ConfirmButton";
import { toggleCouponAction, deleteCouponAction } from "@/app/actions/coupons";
import { couponLabel } from "@/lib/coupons";
import { formatIDR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;

  const total = await prisma.coupon.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const baseHref = "/admin/coupons";

  return (
    <div>
      <h1 className="font-display text-3xl">Kupon</h1>
      <p className="font-medium text-ink/60">Buat & kelola kode diskon.</p>

      <details className="group mt-6 border-3 border-ink bg-white shadow-brutal">
        <summary className="flex cursor-pointer items-center justify-between bg-main px-5 py-3 font-bold uppercase tracking-wide">
          + Buat Kupon Baru
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-5">
          <CouponForm />
        </div>
      </details>

      <div className="mt-6 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Potongan</th>
              <th className="px-4 py-3">Min. Belanja</th>
              <th className="px-4 py-3">Terpakai</th>
              <th className="px-4 py-3">Kedaluwarsa</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada kupon.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3 font-mono font-bold">{c.code}</td>
                  <td className="px-4 py-3">
                    {couponLabel(c.type, c.value)}
                    {c.type === "PERCENT" && c.maxDiscount
                      ? ` (maks ${formatIDR(c.maxDiscount)})`
                      : ""}
                  </td>
                  <td className="px-4 py-3">{c.minSpend ? formatIDR(c.minSpend) : "—"}</td>
                  <td className="px-4 py-3">
                    {c.usedCount}
                    {c.quota != null ? ` / ${c.quota}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.expiresAt ? formatDate(c.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <Badge variant="lime">Aktif</Badge>
                    ) : (
                      <Badge variant="white">Nonaktif</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={`/admin/coupons/${c.id}`}
                        className="border-3 border-ink bg-accent px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm"
                      >
                        Edit
                      </Link>
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="border-3 border-ink bg-white px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                          {c.isActive ? "Matikan" : "Aktifkan"}
                        </button>
                      </form>
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          message={`Hapus kupon ${c.code}?`}
                          className="bg-secondary text-white"
                        >
                          Hapus
                        </ConfirmButton>
                      </form>
                    </div>
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
