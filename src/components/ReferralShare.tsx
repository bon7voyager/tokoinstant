"use client";

import { useState } from "react";

export default function ReferralShare({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const waText = encodeURIComponent(
    `Belanja produk digital murah di Kilat Shop pakai link referral aku — kita berdua dapat bonus saldo! ${link}`,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap border-3 border-ink bg-paper px-3 py-2 font-mono text-sm">
          {link}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {},
            );
          }}
          className="shrink-0 border-3 border-ink bg-main px-3 py-2 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block border-3 border-ink bg-lime px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        💬 Bagikan ke WhatsApp
      </a>
    </div>
  );
}
