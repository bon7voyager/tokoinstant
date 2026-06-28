import Link from "next/link";
import { formatIDR, formatCount } from "@/lib/utils";
import { Badge } from "@/components/ui";

export type ProductCardData = {
  slug: string;
  name: string;
  price: number; // price the viewer pays (reseller-adjusted)
  originalPrice?: number | null; // list price, shown struck-through for resellers
  priceFrom?: boolean; // product has variants -> show "mulai" before the price
  badge?: string | null;
  imageUrl?: string | null;
  fulfillment?: "AUTO" | "MANUAL";
  category?: { name: string; emoji: string } | null;
  stockAvailable: number;
  views?: number; // detail-page views (popularity)
  rating?: { avg: number; count: number } | null; // aggregated buyer rating
  isFlash?: boolean; // a flash sale is active on this product
};

// Deterministic brand visuals based on the product name.
const BRAND_BG: { match: string[]; bg: string; emoji: string }[] = [
  { match: ["netflix"], bg: "bg-secondary", emoji: "🍿" },
  { match: ["youtube"], bg: "bg-secondary", emoji: "▶️" },
  { match: ["spotify"], bg: "bg-lime", emoji: "🎧" },
  { match: ["disney"], bg: "bg-accent", emoji: "🏰" },
  { match: ["canva"], bg: "bg-grape", emoji: "🎨" },
  { match: ["chatgpt", "gpt"], bg: "bg-lime", emoji: "🤖" },
  { match: ["vidio"], bg: "bg-accent", emoji: "⚽" },
  { match: ["capcut"], bg: "bg-bubble", emoji: "✂️" },
  { match: ["prime"], bg: "bg-accent", emoji: "📺" },
  { match: ["hbo"], bg: "bg-grape", emoji: "🎭" },
  { match: ["wetv"], bg: "bg-secondary", emoji: "🎞️" },
  { match: ["apple music", "apple"], bg: "bg-bubble", emoji: "🍎" },
  { match: ["gemini"], bg: "bg-accent", emoji: "✨" },
  { match: ["microsoft", "365"], bg: "bg-accent", emoji: "📊" },
  { match: ["duolingo"], bg: "bg-lime", emoji: "🦉" },
];

export function productVisual(name: string) {
  const lower = name.toLowerCase();
  const hit = BRAND_BG.find((b) => b.match.some((m) => lower.includes(m)));
  return hit ?? { bg: "bg-main", emoji: "📦" };
}

export default function ProductCard({ product }: { product: ProductCardData }) {
  const visual = productVisual(product.name);
  const manual = product.fulfillment === "MANUAL";
  const soldOut = !manual && product.stockAvailable <= 0;

  return (
    <Link
      href={`/produk/${product.slug}`}
      className="group flex flex-col border-3 border-ink bg-white shadow-brutal transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg"
    >
      <div
        className={`relative flex h-32 items-center justify-center overflow-hidden border-b-3 border-ink sm:h-36 ${product.imageUrl ? "bg-white" : visual.bg}`}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl drop-shadow-[3px_3px_0_rgba(0,0,0,0.25)] sm:text-6xl">
            {visual.emoji}
          </span>
        )}
        {product.badge && (
          <span className="absolute left-2 top-2">
            <Badge variant="ink">{product.badge}</Badge>
          </span>
        )}
        {product.isFlash && !soldOut && (
          <span className="absolute right-2 top-2">
            <Badge variant="secondary">⚡ FLASH</Badge>
          </span>
        )}
        {soldOut && (
          <span className="absolute right-2 top-2">
            <Badge variant="white">HABIS</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {product.category && (
          <span className="mb-1 truncate text-[11px] font-bold uppercase tracking-wide text-ink/50 sm:text-xs">
            {product.category.emoji} {product.category.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-bold leading-tight sm:text-base">
          {product.name}
        </h3>

        {/* Rating + views — buyer-facing social proof */}
        <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-bold sm:text-xs">
          {product.rating && product.rating.count > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-ink/70">
              <span className="leading-none">⭐</span>
              {product.rating.avg.toFixed(1)}
              <span className="font-medium text-ink/40">({product.rating.count})</span>
            </span>
          ) : (
            <span className="font-medium text-ink/40">Belum ada ulasan</span>
          )}
          {typeof product.views === "number" && product.views > 0 && (
            <span className="inline-flex items-center gap-0.5 font-medium text-ink/50">
              👁️ {formatCount(product.views)}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          {product.originalPrice && product.originalPrice > product.price && (
            <div className="text-xs font-medium text-ink/40 line-through">
              {formatIDR(product.originalPrice)}
            </div>
          )}
          <div className="font-display text-lg sm:text-xl">
            {product.priceFrom && (
              <span className="text-xs font-bold text-ink/50">mulai </span>
            )}
            {formatIDR(product.price)}
          </div>
          <div className="text-[11px] font-medium text-ink/50 sm:text-xs">
            {manual
              ? "🧑‍💼 Proses manual"
              : soldOut
                ? "Stok habis"
                : `Stok: ${product.stockAvailable}`}
          </div>
          <span className="mt-3 block border-3 border-ink bg-main px-3 py-2 text-center text-sm font-bold uppercase text-ink shadow-brutal-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-brutal">
            Beli Sekarang →
          </span>
        </div>
      </div>
    </Link>
  );
}
