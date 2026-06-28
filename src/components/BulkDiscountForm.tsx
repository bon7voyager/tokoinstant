"use client";

import { useState, useActionState } from "react";
import { saveBulkResellerDiscountAction } from "@/app/actions/reseller";
import { Button, Input, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";
import { usePagedSearch, SearchBar, PagerControls } from "@/components/PagerControls";

type Row = {
  id: string;
  name: string;
  price: number;
  resellerPercent: number | null;
  category: string | null;
};

/** Keep edited values always valid (0–90) so even hidden off-page inputs — which
 * bypass HTML5 constraint validation — can never carry a value the server rejects. */
function sanitizePercent(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 2);
  if (digits === "") return "";
  return String(Math.min(90, Number(digits)));
}

export default function BulkDiscountForm({
  products,
  globalPercent,
}: {
  products: Row[];
  globalPercent: number;
}) {
  const [state, action, pending] = useActionState(
    saveBulkResellerDiscountAction,
    undefined,
  );

  // Edited values live in state so they persist across pages & search; every
  // product is always submitted (visible row OR hidden input) so "Simpan Semua"
  // saves edits made on any page.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [p.id, p.resellerPercent == null ? "" : String(p.resellerPercent)]),
    ),
  );

  const pager = usePagedSearch(products, (p) => `${p.name} ${p.category ?? ""}`, 10);
  const visibleIds = new Set(pager.pageItems.map((p) => p.id));

  // Fall back to the product's own current value when there's no local edit, so a
  // product that appears after mount (e.g. created elsewhere) isn't submitted blank
  // and silently reset to the global default.
  const valueFor = (p: Row) =>
    values[p.id] ?? (p.resellerPercent == null ? "" : String(p.resellerPercent));

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <SearchBar
        value={pager.query}
        onChange={pager.setQuery}
        placeholder="Cari produk…"
      />

      <div className="overflow-x-auto border-3 border-ink">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Harga</th>
              <th className="w-44 px-3 py-2">Diskon Reseller (%)</th>
            </tr>
          </thead>
          <tbody>
            {pager.pageItems.map((p) => (
              <tr key={p.id} className="border-b border-ink/10 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-bold">{p.name}</div>
                  {p.category && (
                    <div className="text-xs text-ink/50">{p.category}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {formatIDR(p.price)}
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={90}
                    name={`rp_${p.id}`}
                    value={valueFor(p)}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [p.id]: sanitizePercent(e.target.value) }))
                    }
                    onKeyDown={(e) => {
                      // Enter in a cell shouldn't trigger the form's "Simpan Semua".
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    placeholder={`global ${globalPercent}%`}
                    className="w-28 !text-sm"
                  />
                </td>
              </tr>
            ))}
            {pager.total === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-5 text-center text-sm font-medium text-ink/50">
                  Produk tidak ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PagerControls
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      {/* Off-page products: keep their (possibly edited) value in the form so a
          single "Simpan Semua" persists edits made on any page. */}
      {products
        .filter((p) => !visibleIds.has(p.id))
        .map((p) => (
          <input key={p.id} type="hidden" name={`rp_${p.id}`} value={valueFor(p)} />
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="grape" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Semua Diskon"}
        </Button>
        <span className="text-xs font-medium text-ink/50">
          Kosong = ikut diskon default global ({globalPercent}%). Isi <b>0</b> = produk
          tanpa diskon reseller.
        </span>
      </div>
    </form>
  );
}
