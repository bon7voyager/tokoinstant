import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Runtime configuration resolver. Admin-editable settings live in the `Setting`
 * table; this module caches them in-process so the existing *synchronous* config
 * helpers (payment provider, membership fee, etc.) can read them without an async
 * refactor. Resolution precedence: DB setting (if non-empty) > env var > default.
 *
 * The cache is process-global (settings are global, not per-user), refreshed
 * lazily on a short TTL and eagerly whenever an admin saves. Kept warm by an
 * `ensureSettings()` call in the root layout.
 */

let cache: Record<string, string> | null = null;
let loadedAt = 0;
const TTL_MS = 30_000;

/** Force-reload the cache from the DB. Call after an admin saves settings. */
export async function refreshSettings(): Promise<void> {
  const rows = await prisma.setting.findMany();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  loadedAt = Date.now();
}

/** Populate the cache if empty or stale. Safe to call on every request. */
export async function ensureSettings(): Promise<void> {
  if (cache === null || Date.now() - loadedAt > TTL_MS) {
    try {
      await refreshSettings();
    } catch {
      // DB unavailable (e.g. during build) -> leave cache as-is; cfg() falls back to env.
    }
  }
}

/** Resolve a config value: DB setting (non-empty) > env var > undefined. Synchronous. */
export function cfg(key: string): string | undefined {
  const v = cache?.[key];
  if (v !== undefined && v !== "") return v;
  const e = process.env[key];
  return e !== undefined && e !== "" ? e : undefined;
}

/** Raw DB settings only (no env fallback) — for rendering the admin form. */
export async function getDbSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
