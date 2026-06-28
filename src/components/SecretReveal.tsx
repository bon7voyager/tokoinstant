"use client";

import { useState } from "react";

export default function SecretReveal({
  secret,
  note,
  index,
}: {
  secret: string;
  note?: string | null;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }

  return (
    <div className="border-3 border-ink bg-paper p-4 shadow-brutal-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink/50">
          Akun #{index + 1}
        </span>
        <button
          onClick={copy}
          className="border-3 border-ink bg-main px-2 py-0.5 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          {copied ? "✓ Tersalin" : "Salin"}
        </button>
      </div>
      <code className="block break-all font-mono text-sm font-bold">{secret}</code>
      {note && <p className="mt-2 text-xs font-medium text-ink/60">{note}</p>}
    </div>
  );
}
