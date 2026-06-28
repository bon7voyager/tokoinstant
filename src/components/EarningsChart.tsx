import { formatIDR } from "@/lib/utils";
import type { EarningsBucket } from "@/lib/earnings";

/** Compact rupiah for cramped bar labels: 1.500.000 -> "1,5jt", 250.000 -> "250rb". */
function shortIDR(n: number): string {
  if (n <= 0) return "";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return (v % 1 === 0 ? String(v) : v.toFixed(1).replace(".", ",")) + "jt";
  }
  if (n >= 1_000) return Math.round(n / 1_000) + "rb";
  return String(n);
}

const MAX_BAR = 220; // px

export default function EarningsChart({
  buckets,
  max,
}: {
  buckets: EarningsBucket[];
  max: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-full" style={{ minWidth: buckets.length * 40 }}>
        {/* Bars */}
        <div className="flex items-end gap-1.5" style={{ height: MAX_BAR + 28 }}>
          {buckets.map((b, i) => {
            const h = b.total > 0 ? Math.max(6, Math.round((b.total / max) * MAX_BAR)) : 2;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                style={{ minWidth: 34 }}
              >
                {b.total > 0 && (
                  <span className="text-[8px] font-bold leading-none text-ink/70">
                    {shortIDR(b.total)}
                  </span>
                )}
                <div
                  className="w-full border-3 border-ink bg-lime transition-colors hover:bg-main"
                  style={{ height: h }}
                  title={`${b.label}: ${formatIDR(b.total)}`}
                />
              </div>
            );
          })}
        </div>
        {/* X labels */}
        <div className="mt-2 flex gap-1.5 border-t-3 border-ink pt-2">
          {buckets.map((b, i) => (
            <span
              key={i}
              className="flex-1 truncate text-center text-[9px] font-bold uppercase tracking-wide text-ink/55"
              style={{ minWidth: 34 }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
