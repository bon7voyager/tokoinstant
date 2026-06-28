import "server-only";
import { prisma } from "@/lib/prisma";

export type EarningsRange = "harian" | "mingguan" | "bulanan" | "all";

export type EarningsBucket = { label: string; total: number };

export type EarningsData = {
  range: EarningsRange;
  rangeLabel: string;
  buckets: EarningsBucket[];
  total: number; // total revenue in range
  count: number; // number of paid transactions in range
  avg: number; // average per transaction
  max: number; // tallest bucket (for chart scaling)
  prevTotal: number; // total of the equivalent previous period
  deltaPct: number | null; // % change vs previous period (null = N/A)
};

const DAY = 86_400_000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type Unit = "day" | "week" | "month";

function bucketStart(d: Date, unit: Unit) {
  return unit === "day" ? startOfDay(d) : unit === "week" ? startOfWeek(d) : startOfMonth(d);
}
function shiftBucket(start: Date, unit: Unit, n: number) {
  if (unit === "day") return new Date(start.getTime() - n * DAY);
  if (unit === "week") return new Date(start.getTime() - n * 7 * DAY);
  return new Date(start.getFullYear(), start.getMonth() - n, 1);
}

const fmtDay = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const fmtMonth = (d: Date) => d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

const CONFIG: Record<EarningsRange, { label: string; unit: Unit; count: number | "all" }> = {
  harian: { label: "7 Hari Terakhir", unit: "day", count: 7 },
  mingguan: { label: "4 Minggu Terakhir", unit: "week", count: 4 },
  bulanan: { label: "12 Bulan Terakhir", unit: "month", count: 12 },
  all: { label: "Sepanjang Waktu", unit: "month", count: "all" },
};

export const EARNINGS_RANGES: { key: EarningsRange; label: string }[] = [
  { key: "harian", label: "Harian" },
  { key: "mingguan", label: "Mingguan" },
  { key: "bulanan", label: "Bulanan" },
  { key: "all", label: "All Time" },
];

export function isEarningsRange(v: string | undefined): v is EarningsRange {
  return !!v && v in CONFIG;
}

/** Start of the range window (earliest bucket start); null for "all" (no lower bound). */
export function rangeWindowStart(range: EarningsRange): Date | null {
  const cfg = CONFIG[range];
  if (cfg.count === "all") return null;
  const end = bucketStart(new Date(), cfg.unit);
  return shiftBucket(end, cfg.unit, cfg.count - 1);
}

export type TopProduct = {
  name: string;
  revenue: number;
  qty: number;
  pct: number; // share of range revenue
};

/** Best-selling items (by revenue) within the range. Memberships are one combined row. */
export async function getTopProducts(range: EarningsRange, limit = 8): Promise<TopProduct[]> {
  const start = rangeWindowStart(range);
  const inRange = (d: Date) => !start || d.getTime() >= start.getTime();

  const [orders, memberships] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["COMPLETED", "PAID"] } },
      select: {
        total: true,
        quantity: true,
        paidAt: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.membershipPurchase.findMany({
      where: { status: "PAID" },
      select: { amount: true, paidAt: true, createdAt: true },
    }),
  ]);

  const map = new Map<string, { revenue: number; qty: number }>();
  const add = (name: string, revenue: number, qty: number) => {
    const cur = map.get(name) ?? { revenue: 0, qty: 0 };
    cur.revenue += revenue;
    cur.qty += qty;
    map.set(name, cur);
  };

  for (const o of orders) {
    if (inRange(o.paidAt ?? o.createdAt)) add(o.product?.name ?? "Produk", o.total, o.quantity);
  }
  let memRev = 0;
  let memQty = 0;
  for (const m of memberships) {
    if (inRange(m.paidAt ?? m.createdAt)) {
      memRev += m.amount;
      memQty += 1;
    }
  }
  if (memRev > 0) add("💎 Membership Reseller", memRev, memQty);

  const totalRev = [...map.values()].reduce((s, v) => s + v.revenue, 0);
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      revenue: v.revenue,
      qty: v.qty,
      pct: totalRev ? Math.round((v.revenue / totalRev) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getEarnings(range: EarningsRange): Promise<EarningsData> {
  const cfg = CONFIG[range];
  const unit = cfg.unit;
  const now = new Date();
  const end = bucketStart(now, unit);

  // Revenue events = paid orders (delivered or awaiting manual delivery) + paid memberships.
  const [orders, memberships] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["COMPLETED", "PAID"] } },
      select: { total: true, paidAt: true, createdAt: true },
    }),
    prisma.membershipPurchase.findMany({
      where: { status: "PAID" },
      select: { amount: true, paidAt: true, createdAt: true },
    }),
  ]);

  const events: { at: Date; amount: number }[] = [
    ...orders.map((o) => ({ at: o.paidAt ?? o.createdAt, amount: o.total })),
    ...memberships.map((m) => ({ at: m.paidAt ?? m.createdAt, amount: m.amount })),
  ];

  // Resolve bucket count (for "all", span from the earliest event, capped).
  let n = cfg.count === "all" ? 1 : cfg.count;
  if (cfg.count === "all" && events.length) {
    const earliest = bucketStart(
      new Date(Math.min(...events.map((e) => e.at.getTime()))),
      unit,
    );
    n = (end.getFullYear() - earliest.getFullYear()) * 12 + (end.getMonth() - earliest.getMonth()) + 1;
    n = Math.min(Math.max(n, 1), 36);
  }

  // Ordered bucket starts (oldest -> newest).
  const starts: Date[] = [];
  for (let i = n - 1; i >= 0; i--) starts.push(shiftBucket(end, unit, i));
  const index = new Map<number, number>();
  starts.forEach((s, i) => index.set(s.getTime(), i));

  // Previous equivalent period = the n buckets immediately before the first one.
  const prevKeys = new Set<number>();
  if (cfg.count !== "all") {
    for (let i = 1; i <= n; i++) prevKeys.add(shiftBucket(starts[0], unit, i).getTime());
  }

  const totals = new Array(starts.length).fill(0);
  let total = 0;
  let count = 0;
  let prevTotal = 0;
  for (const e of events) {
    const key = bucketStart(e.at, unit).getTime();
    const i = index.get(key);
    if (i !== undefined) {
      totals[i] += e.amount;
      total += e.amount;
      count += 1;
    } else if (prevKeys.has(key)) {
      prevTotal += e.amount;
    }
  }

  const fmt = unit === "month" ? fmtMonth : fmtDay;
  const buckets = starts.map((s, i) => ({ label: fmt(s), total: totals[i] }));

  const deltaPct =
    cfg.count === "all" || prevTotal <= 0
      ? null
      : Math.round(((total - prevTotal) / prevTotal) * 100);

  return {
    range,
    rangeLabel: cfg.label,
    buckets,
    total,
    count,
    avg: count ? Math.round(total / count) : 0,
    max: Math.max(1, ...totals),
    prevTotal,
    deltaPct,
  };
}
