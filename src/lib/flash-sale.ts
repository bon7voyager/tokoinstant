import "server-only";
import { prisma } from "@/lib/prisma";
import { resellerPrice } from "@/lib/membership";

export type FlashInfo = { percent: number; endsAt: Date };

/** Flash price = list minus a clamped percent. */
export function flashPriceOf(list: number, percent: number): number {
  const p = Math.min(90, Math.max(0, percent));
  return Math.max(0, Math.round((list * (100 - p)) / 100));
}

/**
 * Effective unit price a buyer pays. Flash sale applies to everyone; a reseller
 * pays the LOWER of their reseller price vs the flash price (no double discount).
 */
export function effectivePrice(
  list: number,
  premium: boolean,
  resellerPercent: number | null,
  flash: FlashInfo | null,
): { price: number; listPrice: number; isFlash: boolean; flashEndsAt: Date | null } {
  const reseller = resellerPrice(list, premium, resellerPercent);
  if (!flash) return { price: reseller, listPrice: list, isFlash: false, flashEndsAt: null };
  const fp = flashPriceOf(list, flash.percent);
  const flashWins = fp < reseller; // only advertise flash when it's actually the price paid
  return {
    price: Math.min(reseller, fp),
    listPrice: list,
    isFlash: flashWins,
    flashEndsAt: flashWins ? flash.endsAt : null,
  };
}

/** Active flash info per product id (now within an active sale window). When a
 * product is in several active sales, the biggest discount wins. */
export async function getFlashInfos(productIds: string[]): Promise<Map<string, FlashInfo>> {
  if (productIds.length === 0) return new Map();
  const now = new Date();
  const items = await prisma.flashSaleItem.findMany({
    where: {
      productId: { in: productIds },
      flashSale: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
    },
    select: { productId: true, percent: true, flashSale: { select: { endsAt: true } } },
  });
  const map = new Map<string, FlashInfo>();
  for (const it of items) {
    const cur = map.get(it.productId);
    if (!cur || it.percent > cur.percent) {
      map.set(it.productId, { percent: it.percent, endsAt: it.flashSale.endsAt });
    }
  }
  return map;
}

/** Active flash info for a single product (or null). */
export async function getFlashInfo(productId: string): Promise<FlashInfo | null> {
  return (await getFlashInfos([productId])).get(productId) ?? null;
}
