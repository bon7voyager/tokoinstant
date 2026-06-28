"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RecentTxn, TxnStatus } from "@/lib/transactions";
import { recentTransactionsAction } from "@/app/actions/track";

const STATUS_STYLE: Record<TxnStatus, string> = {
  SUCCESS: "bg-lime text-ink",
  PENDING: "bg-main text-ink",
  FAILED: "bg-secondary text-white",
};

export default function RealtimeTransactions({ initial }: { initial: RecentTxn[] }) {
  const [rows, setRows] = useState<RecentTxn[]>(initial);

  // Poll for fresh masked transactions (real-time feel).
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await recentTransactionsAction();
        if (active && data.length) setRows(data);
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (rows.length === 0) {
    return (
      <p className="border-3 border-ink bg-white p-6 text-center text-sm font-medium text-ink/50 shadow-brutal">
        Belum ada transaksi.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border-3 border-ink bg-white shadow-brutal">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b-3 border-ink bg-paper">
          <tr className="font-bold uppercase">
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">Nomor Invoice</th>
            <th className="px-4 py-3">Produk</th>
            <th className="px-4 py-3">Harga</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.invoice}-${i}`} className="border-b border-ink/10 last:border-0">
              <td className="px-4 py-3 font-medium text-ink/70">{r.date}</td>
              <td className="px-4 py-3 font-mono">
                <Link
                  href={`/cek-transaksi?invoice=${encodeURIComponent(r.invoice)}#cari`}
                  className="underline decoration-2 underline-offset-2 hover:text-secondary"
                  title="Lihat detail pesanan ini"
                >
                  {r.invoice}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium">{r.product}</td>
              <td className="px-4 py-3 font-bold">{r.price}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block border-2 border-ink px-2.5 py-1 text-xs font-bold uppercase ${STATUS_STYLE[r.status]}`}
                >
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
