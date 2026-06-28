"use client";

import { useActionState, useState } from "react";
import { addStockAction } from "@/app/actions/admin";
import { Button, Label, Textarea, Select, Input, Alert } from "@/components/ui";

type ProductOption = {
  id: string;
  name: string;
  variants: { id: string; name: string }[];
};

export default function AddStockForm({ products }: { products: ProductOption[] }) {
  const [state, formAction, pending] = useActionState(addStockAction, undefined);
  const [productId, setProductId] = useState(products[0]?.id ?? "");

  const current = products.find((p) => p.id === productId);
  const variants = current?.variants ?? [];

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="productId">Produk</Label>
        <Select
          id="productId"
          name="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {variants.length > 0 && (
        <div>
          <Label htmlFor="variantId">Varian</Label>
          <Select id="variantId" name="variantId" required>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs font-medium text-ink/50">
            Produk ini punya varian — stok masuk ke varian yang dipilih.
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="items">Daftar Stok (satu akun per baris)</Label>
        <Textarea
          id="items"
          name="items"
          rows={6}
          placeholder={"email1@mail.com:password1\nemail2@mail.com:password2\nKODE-VOUCHER-XYZ"}
          required
          className="font-mono text-sm"
        />
        <p className="mt-1 text-xs font-medium text-ink/50">
          Setiap baris = 1 stok yang akan dikirim otomatis ke pembeli.
        </p>
      </div>

      <div>
        <Label htmlFor="note">Catatan (opsional, berlaku untuk semua baris)</Label>
        <Input
          id="note"
          name="note"
          placeholder="Durasi 30 hari | Profil 1 | Jangan ganti password"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "+ Tambah Stok"}
      </Button>
    </form>
  );
}
