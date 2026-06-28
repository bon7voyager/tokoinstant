import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isPremium } from "@/lib/membership";
import { apiError, apiUnauthorized } from "@/lib/api-response";

const PREFIX = "rsk_live_"; // reseller secret key

export type ResellerApiUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  balance: number;
  premiumUntil: Date | null;
  apiCallbackUrl: string | null;
  apiCallbackSecret: string | null;
};

/** sha256 of the full key — what we store & look up by (never the raw key). */
export function hashKey(full: string): string {
  return createHash("sha256").update(full).digest("hex");
}

/** Generate a fresh key. The `full` value is returned ONCE to the reseller; we
 * persist only `prefix` (for display) + `hash`. */
export function generateApiKey(): { full: string; prefix: string; hash: string } {
  const full = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  return { full, prefix: full.slice(0, 14), hash: hashKey(full) };
}

/**
 * Authenticate an `Authorization: Bearer <key>` request header. Returns the
 * owning reseller (or null). Touches lastUsedAt fire-and-forget.
 */
export async function authenticateApiKey(req: Request): Promise<ResellerApiUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token.startsWith(PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          balance: true,
          premiumUntil: true,
          apiCallbackUrl: true,
          apiCallbackSecret: true,
        },
      },
    },
  });
  if (!key || key.revokedAt) return null;

  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return key.user;
}

/**
 * Authenticate AND authorize: a valid key whose owner is an active reseller.
 * Returns the reseller, or a ready-to-send error Response (401 / 403).
 */
export async function requireReseller(req: Request): Promise<ResellerApiUser | Response> {
  const user = await authenticateApiKey(req);
  if (!user) return apiUnauthorized();
  if (!isPremium(user)) {
    return apiError(
      403,
      "membership_inactive",
      "Membership reseller tidak aktif. Perpanjang membership untuk memakai API.",
    );
  }
  return user;
}
