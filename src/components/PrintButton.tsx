"use client";

export default function PrintButton({ label = "🖨️ Cetak / Simpan PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border-3 border-ink bg-main px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
    >
      {label}
    </button>
  );
}
