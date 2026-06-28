"use client";

import {
  adminGrantPremiumAction,
  adminRevokePremiumAction,
} from "@/app/actions/membership";
import { formatDate, formatIDR } from "@/lib/utils";
import { usePagedSearch, SearchBar, PagerControls } from "@/components/PagerControls";

type Row = {
  id: string;
  name: string;
  email: string;
  premiumUntil: string | null;
  amount: number | null;
  days: number | null;
};

export default function ResellerTable({
  resellers,
  days,
}: {
  resellers: Row[];
  days: number;
}) {
  const pager = usePagedSearch(
    resellers,
    (u) => `${u.name} ${u.email}`,
    10,
  );

  if (resellers.length === 0) {
    return (
      <p className="text-sm font-medium text-ink/50">
        Belum ada reseller aktif. Aktifkan lewat{" "}
        <a href="/admin/users" className="brutal-link">
          menu Pengguna
        </a>
        .
      </p>
    );
  }

  return (
    <div>
      <SearchBar
        value={pager.query}
        onChange={pager.setQuery}
        placeholder="Cari nama / email…"
      />

      <div className="overflow-x-auto border-3 border-ink">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Nominal &amp; Durasi</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((u) => (
              <tr key={u.id} className="border-b border-ink/10 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-bold">{u.name}</div>
                </td>
                <td className="px-3 py-2 font-medium">{u.email}</td>
                <td className="px-3 py-2">
                  <div className="font-bold">
                    {u.amount != null ? formatIDR(u.amount) : "Diberi admin"}
                  </div>
                  <div className="text-xs font-medium text-ink/50">
                    {u.days != null ? `${u.days} hari · ` : ""}aktif s/d{" "}
                    {u.premiumUntil ? formatDate(u.premiumUntil) : "-"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <form action={adminGrantPremiumAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="border-3 border-ink bg-grape px-2 py-1 text-xs font-bold uppercase text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                        +{days} hari
                      </button>
                    </form>
                    <form action={adminRevokePremiumAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="border-3 border-ink bg-white px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                        Cabut
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {pager.total === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-center text-sm font-medium text-ink/50">
                  Tidak ada reseller yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PagerControls
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
    </div>
  );
}
