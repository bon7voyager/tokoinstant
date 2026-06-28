"use client";

import { useActionState, useState } from "react";
import { createFlashSaleAction } from "@/app/actions/flash-sale";
import { Button, Input, Label, Alert } from "@/components/ui";
import { formatIDR } from "@/lib/utils";

type P = { id: string; name: string; price: number };
type Sel = Record<string, { on: boolean; percent: string }>;

export default function FlashSaleForm({ products }: { products: P[] }) {
  const [state, action, pending] = useActionState(createFlashSaleAction, undefined);
  const [sel, setSel] = useState<Sel>({});

  const items = JSON.stringify(
    products
      .filter((p) => sel[p.id]?.on && sel[p.id]?.percent)
      .map((p) => ({ productId: p.id, percent: Number(sel[p.id].percent) || 0 })),
  );
  const count = products.filter((p) => sel[p.id]?.on).length;

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="items" value={items} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-bold">Nama</span>
          <Input name="name" placeholder="Flash Sale Akhir Pekan" maxLength={60} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Mulai</span>
          <Input type="datetime-local" name="startsAt" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Berakhir</span>
          <Input type="datetime-local" name="endsAt" required />
        </label>
      </div>

      <div>
        <Label>Produk &amp; Diskon ({count} dipilih)</Label>
        <div className="mt-1 max-h-80 overflow-auto border-3 border-ink">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b-3 border-ink bg-paper">
              <tr className="font-bold uppercase">
                <th className="px-3 py-2">Pilih</th>
                <th className="px-3 py-2">Produk</th>
                <th className="px-3 py-2">Harga</th>
                <th className="w-28 px-3 py-2">Diskon %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={sel[p.id]?.on ?? false}
                      onChange={(e) =>
                        setSel((s) => ({
                          ...s,
                          [p.id]: { on: e.target.checked, percent: s[p.id]?.percent ?? "" },
                        }))
                      }
                      className="h-5 w-5 border-3 border-ink accent-grape"
                    />
                  </td>
                  <td className="px-3 py-2 font-bold">{p.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {formatIDR(p.price)}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={sel[p.id]?.percent ?? ""}
                      onChange={(e) =>
                        setSel((s) => ({
                          ...s,
                          [p.id]: { on: s[p.id]?.on ?? true, percent: e.target.value },
                        }))
                      }
                      placeholder="%"
                      className="w-20 !text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button type="submit" variant="grape" disabled={pending}>
        {pending ? "Menyimpan…" : "+ Buat Flash Sale"}
      </Button>
    </form>
  );
}
