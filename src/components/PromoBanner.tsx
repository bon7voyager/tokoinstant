"use client";

import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui";

type Props = {
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  version: string;
};

const STORAGE_KEY = "kilatPromoBanner";

export default function PromoBanner({ title, body, imageUrl, ctaLabel, ctaUrl, version }: Props) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Show once per content version: a new/edited banner (new version) pops up again.
  useEffect(() => {
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked -> just show */
    }
    if (dismissed !== version) setOpen(true);
  }, [version]);

  // While open: move focus into the dialog, lock body scroll, and wire Escape.
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  const external = /^https?:\/\//.test(ctaUrl);

  return (
    // Outer layer scrolls; inner flex centers but lets tall content scroll without clipping.
    <div
      onClick={close}
      className="fixed inset-0 z-[100] overflow-y-auto bg-ink/60"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title || "Pengumuman"}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md border-3 border-ink bg-white shadow-brutal-lg focus:outline-none"
        >
          <button
            onClick={close}
            aria-label="Tutup"
            className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center border-3 border-ink bg-secondary font-display text-white shadow-brutal-sm transition-transform hover:-translate-y-0.5 sm:-right-3 sm:-top-3"
          >
            ✕
          </button>

          {imageUrl && imgOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title || "Promo"}
              onError={() => setImgOk(false)}
              className="max-h-56 w-full border-b-3 border-ink object-cover"
            />
          )}

          <div className="p-5 sm:p-6">
            {title && <h2 className="font-display text-2xl leading-tight">{title}</h2>}
            {body && (
              <p className="mt-2 whitespace-pre-line font-medium text-ink/70">{body}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {ctaLabel && ctaUrl && (
                <a
                  href={ctaUrl}
                  onClick={close}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={buttonStyles("main", "md")}
                >
                  {ctaLabel}
                </a>
              )}
              <button onClick={close} className={buttonStyles("white", "md")}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
