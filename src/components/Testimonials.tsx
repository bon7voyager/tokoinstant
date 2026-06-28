"use client";

import { useEffect, useRef, useState } from "react";
import type { Testimonial } from "@/lib/ratings";
import { timeAgo } from "@/lib/utils";

const AVATAR_BG = ["bg-main", "bg-accent", "bg-lime", "bg-bubble", "bg-grape text-white"];

export default function Testimonials({ items }: { items: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const scrollByCard = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 16 : track.clientWidth;
    const maxLeft = track.scrollWidth - track.clientWidth;
    let next = track.scrollLeft + dir * step;
    if (dir === 1 && track.scrollLeft >= maxLeft - 4) next = 0; // loop to start
    if (dir === -1 && track.scrollLeft <= 4) next = maxLeft; // loop to end
    track.scrollTo({ left: next, behavior: "smooth" });
  };

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => scrollByCard(1), 4500);
    return () => clearInterval(t);
  }, [paused, items.length]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((t, i) => (
          <div
            key={i}
            data-card
            className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
          >
            <div className="flex h-full flex-col border-3 border-ink bg-white p-5 text-ink shadow-brutal">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm leading-none">{"⭐".repeat(t.stars)}</div>
                <span suppressHydrationWarning className="shrink-0 text-xs font-medium text-ink/40">
                  {timeAgo(t.createdAt)}
                </span>
              </div>
              <p className="mt-3 flex-1 text-sm font-medium leading-relaxed text-ink/80">
                “{t.comment}”
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center border-3 border-ink ${AVATAR_BG[i % AVATAR_BG.length]} font-display`}
                >
                  {t.name[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold leading-tight">{t.name}</div>
                  <div className="truncate text-xs text-ink/50">{t.product}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Testimoni sebelumnya"
            className="border-3 border-ink bg-white px-3.5 py-1.5 font-bold shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Testimoni berikutnya"
            className="border-3 border-ink bg-main px-3.5 py-1.5 font-bold text-ink shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
