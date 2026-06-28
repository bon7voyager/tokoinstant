import Link from "next/link";
import { cn, formatIDR } from "@/lib/utils";
import { buttonStyles } from "@/components/ui";
import {
  getEarnings,
  getTopProducts,
  isEarningsRange,
  EARNINGS_RANGES,
  type EarningsRange,
} from "@/lib/earnings";
import EarningsChart from "@/components/EarningsChart";

export const dynamic = "force-dynamic";

export default async function AdminEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: raw } = await searchParams;
  const range: EarningsRange = isEarningsRange(raw) ? raw : "bulanan";
  const [data, topProducts] = await Promise.all([getEarnings(range), getTopProducts(range)]);

  const delta = data.deltaPct;
  const deltaNode =
    delta === null ? null : (
      <span
        className={cn(
          "mt-1 inline-block text-xs font-extrabold uppercase",
          delta >= 0 ? "text-ink" : "text-secondary",
        )}
      >
        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs periode lalu
      </span>
    );

  const stats = [
    { label: "Total Penghasilan", value: formatIDR(data.total), bg: "bg-lime", sub: deltaNode },
    { label: "Jumlah Transaksi", value: data.count.toLocaleString("id-ID"), bg: "bg-main", sub: null },
    { label: "Rata-rata / Transaksi", value: formatIDR(data.avg), bg: "bg-accent", sub: null },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Penghasilan</h1>
          <p className="font-medium text-ink/60">
            Pendapatan dari penjualan produk &amp; membership yang sudah dibayar.
          </p>
        </div>
        <a
          href={`/admin/earnings/export?range=${range}`}
          className={buttonStyles("ink", "sm")}
          download
        >
          ⬇️ Export CSV
        </a>
      </div>

      {/* Range tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {EARNINGS_RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/earnings?range=${r.key}`}
            aria-current={r.key === range ? "page" : undefined}
            className={cn(
              "border-3 border-ink px-3 py-2 text-sm font-bold uppercase tracking-wide shadow-brutal-sm transition-all",
              r.key === range
                ? "bg-ink text-paper"
                : "bg-white hover:-translate-y-0.5 hover:shadow-brutal",
            )}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={cn("border-3 border-ink p-5 shadow-brutal", s.bg)}>
            <div className="text-xs font-bold uppercase tracking-wide text-ink/70">
              {s.label}
            </div>
            <div className="mt-1 font-display text-2xl">{s.value}</div>
            {s.sub}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-6 border-3 border-ink bg-surface p-5 shadow-brutal sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl">Grafik Penghasilan</h2>
          <span className="text-sm font-bold uppercase tracking-wide text-ink/55">
            {data.rangeLabel} · maks {formatIDR(data.max)}
          </span>
        </div>
        {data.total > 0 ? (
          <EarningsChart buckets={data.buckets} max={data.max} />
        ) : (
          <div className="border-3 border-dashed border-ink/30 px-4 py-12 text-center font-bold text-ink/50">
            Belum ada penghasilan di rentang ini.
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="mt-6 border-3 border-ink bg-surface p-5 shadow-brutal sm:p-6">
        <h2 className="mb-4 font-display text-xl">Produk Terlaris</h2>
        {topProducts.length === 0 ? (
          <div className="border-3 border-dashed border-ink/30 px-4 py-8 text-center font-bold text-ink/50">
            Belum ada penjualan di rentang ini.
          </div>
        ) : (
          <ul className="space-y-3">
            {topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border-3 border-ink bg-main font-display text-sm">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">{p.name}</span>
                    <span className="shrink-0 font-display text-sm">{formatIDR(p.revenue)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden border-2 border-ink bg-paper">
                      <div className="h-full bg-lime" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-ink/55">
                      {p.qty} terjual · {p.pct}%
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
