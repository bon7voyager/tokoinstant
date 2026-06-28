"use client";

import { Badge } from "@/components/ui";
import { formatDate, formatIDR } from "@/lib/utils";
import { usePagedSearch, SearchBar, PagerControls } from "@/components/PagerControls";

type Row = {
  id: string;
  name: string;
  email: string;
  amount: number;
  days: number;
  status: string;
  createdAt: string;
};

const TONE: Record<string, "lime" | "main" | "secondary" | "white"> = {
  PAID: "lime",
  PENDING: "main",
  FAILED: "secondary",
  EXPIRED: "white",
};

export default function PurchaseTable({ purchases }: { purchases: Row[] }) {
  const pager = usePagedSearch(
    purchases,
    (p) => `${p.name} ${p.email} ${p.status}`,
    10,
  );

  if (purchases.length === 0) {
    return (
      <p className="text-sm font-medium text-ink/50">
        Belum ada pembelian membership.
      </p>
    );
  }

  return (
    <div>
      <SearchBar
        value={pager.query}
        onChange={pager.setQuery}
        placeholder="Cari nama / email / status…"
      />

      <div className="overflow-x-auto border-3 border-ink">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Nominal</th>
              <th className="px-3 py-2">Durasi</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((p) => (
              <tr key={p.id} className="border-b border-ink/10 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-ink/50">{p.email}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-bold">
                  {formatIDR(p.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{p.days} hari</td>
                <td className="px-3 py-2">
                  <Badge variant={TONE[p.status] ?? "white"}>{p.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-ink/60">
                  {formatDate(p.createdAt)}
                </td>
              </tr>
            ))}
            {pager.total === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-sm font-medium text-ink/50">
                  Tidak ada pembelian yang cocok.
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
