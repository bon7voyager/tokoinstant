export function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact count for popularity figures (Indonesian): 950 -> "950",
 * 1_200 -> "1,2rb", 12_000 -> "12rb", 3_400_000 -> "3,4jt". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.trunc(n || 0)));
  const fmt = (v: number) =>
    (v < 10 ? v.toFixed(1).replace(/\.0$/, "") : String(Math.round(v))).replace(".", ",");
  // Threshold accounts for rounding: 999_500..999_999 must roll over to "1jt",
  // not the nonsensical "1000rb".
  if (n < 999_500) return `${fmt(n / 1000)}rb`;
  return `${fmt(n / 1_000_000)}jt`;
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    // Pin to WIB so server (SSR) and client render the same string (no hydration
    // mismatch) and admins always see Indonesian time regardless of server TZ.
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

/** Relative "time ago" in Indonesian, e.g. "baru saja", "2 jam lalu", "3 hari lalu". */
export function timeAgo(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} minggu lalu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.floor(d / 365)} tahun lalu`;
}

// Order number like INV-20260625-AB12CD
export function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Normalize an email for IDENTITY comparison (anti-abuse), not for storage:
 * lowercase, drop any "+tag", and for Gmail/Googlemail strip dots in the local
 * part — they all deliver to the same inbox, so they're the same person. */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0]!;
  const domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
