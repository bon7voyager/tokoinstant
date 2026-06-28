import "server-only";
import { headers } from "next/headers";

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

/**
 * Simple in-memory fixed-window rate limiter (per server instance). Returns true
 * when the action is allowed, false when the limit for this key/window is hit.
 *
 * Note: state is per-process — adequate for a single-instance deployment. Behind
 * multiple instances or for hard guarantees, back this with the DB/Redis instead.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Best-effort client IP from proxy headers, for rate-limit keys. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
