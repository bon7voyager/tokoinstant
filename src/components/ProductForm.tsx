"use client";

import { useActionState, useState } from "react";
import { createProductAction, updateProductAction } from "@/app/actions/admin";
import { Button, Input, Label, Textarea, Select, Alert } from "@/components/ui";

type Category = { id: string; name: string; emoji: string };
type Variant = { id: string; name: string; price: number; isActive: boolean };
type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  badge: string | null;
  warranty: string | null;
  instant: boolean;
  isOfficial: boolean;
  categoryId: string | null;
  imageUrl: string | null;
  fulfillment: "AUTO" | "MANUAL";
  resellerPercent: number | null;
  variants?: Variant[];
};

type VariantRow = { id?: string; name: string; price: string; isActive: boolean };

export default function ProductForm({
  categories,
  product,
  globalResellerPercent,
}: {
  categories: Category[];
  product?: Product;
  globalResellerPercent: number;
}) {
  const isEdit = !!product;
  const action = isEdit ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants?.map((v) => ({
      id: v.id,
      name: v.name,
      price: String(v.price),
      isActive: v.isActive,
    })) ?? [],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  }

  const updateVariant = (i: number, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addVariant = () =>
    setVariants((rows) => [...rows, { name: "", price: "", isActive: true }]);
  const removeVariant = (i: number) =>
    setVariants((rows) => rows.filter((_, j) => j !== i));

  const variantsJson = JSON.stringify(
    variants
      .filter((v) => v.name.trim())
      .map((v) => ({ id: v.id, name: v.name.trim(), price: Number(v.price) || 0, isActive: v.isActive })),
  );

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={product.id} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Nama Produk</Label>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            placeholder="Netflix Premium 1 Bulan"
            required
          />
        </div>

        <div>
          <Label htmlFor="price">Harga (Rp)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            defaultValue={product?.price}
            placeholder="25000"
            required
          />
        </div>

        <div>
          <Label htmlFor="categoryId">Kategori</Label>
          <Select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""}>
            <option value="">— Tanpa kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="badge">Label Terlaris (opsional)</Label>
          <Input
            id="badge"
            name="badge"
            defaultValue={product?.badge ?? ""}
            placeholder="TERLARIS / BARU / HOT"
          />
        </div>

        <div>
          <Label htmlFor="warranty">Durasi Garansi (opsional)</Label>
          <Input
            id="warranty"
            name="warranty"
            defaultValue={product?.warranty ?? ""}
            placeholder="cth: 30 Hari / Garansi Penuh"
          />
          <p className="mt-1 text-xs font-medium text-ink/50">
            Tampil di badge “🛡️ Garansi …”. Kosong = tampil “Garansi” saja.
          </p>
        </div>

        <div>
          <Label htmlFor="fulfillment">Pengiriman</Label>
          <Select
            id="fulfillment"
            name="fulfillment"
            defaultValue={product?.fulfillment ?? "AUTO"}
          >
            <option value="AUTO">Otomatis dari stok</option>
            <option value="MANUAL">Manual oleh admin</option>
          </Select>
          <p className="mt-1 text-xs font-medium text-ink/50">
            Manual: tanpa stok, kamu kirim sendiri setelah pembeli bayar.
          </p>
        </div>

        <div>
          <Label htmlFor="resellerPercent">Diskon Reseller (%)</Label>
          <Input
            id="resellerPercent"
            name="resellerPercent"
            type="number"
            min={0}
            max={90}
            step={1}
            defaultValue={product?.resellerPercent ?? ""}
            placeholder={`default ${globalResellerPercent}%`}
          />
          <p className="mt-1 text-xs font-medium text-ink/50">
            Diskon khusus member reseller untuk produk ini. Kosong = ikut default
            global ({globalResellerPercent}%). Isi <b>0</b> = produk ini tanpa diskon
            reseller.
          </p>
        </div>

        {/* Highlight badges */}
        <div className="sm:col-span-2">
          <Label>Badge Sorotan</Label>
          <div className="flex flex-wrap gap-4 border-3 border-ink bg-paper p-3">
            <label className="flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                name="instant"
                value="true"
                defaultChecked={product?.instant ?? true}
                className="h-5 w-5 border-3 border-ink accent-grape"
              />
              ⚡ Instan
            </label>
            <label className="flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                name="isOfficial"
                value="true"
                defaultChecked={product?.isOfficial ?? true}
                className="h-5 w-5 border-3 border-ink accent-grape"
              />
              ✅ Resmi
            </label>
          </div>
          <p className="mt-1 text-xs font-medium text-ink/50">
            Centang badge yang ingin ditampilkan di halaman produk. Untuk produk
            manual, biasanya “Instan” dimatikan.
          </p>
        </div>

        {/* Varian */}
        <div className="sm:col-span-2">
          <Label>Varian (opsional)</Label>
          <input type="hidden" name="variants" value={variantsJson} />
          <p className="mb-2 text-xs font-medium text-ink/50">
            Kalau diisi, pembeli memilih varian & harga varian yang dipakai. Stok diisi
            per varian di menu Stok. Kosongkan jika produk tanpa varian.
          </p>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 border-3 border-ink bg-paper p-2"
              >
                <Input
                  value={v.name}
                  onChange={(e) => updateVariant(i, { name: e.target.value })}
                  placeholder="Nama (mis. 1 Bulan)"
                  className="min-w-[140px] flex-1 !text-sm"
                />
                <Input
                  type="number"
                  min={0}
                  value={v.price}
                  onChange={(e) => updateVariant(i, { price: e.target.value })}
                  placeholder="Harga"
                  className="w-28 !text-sm"
                />
                <label className="flex items-center gap-1.5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={v.isActive}
                    onChange={(e) => updateVariant(i, { isActive: e.target.checked })}
                    className="h-4 w-4 border-3 border-ink accent-grape"
                  />
                  Aktif
                </label>
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  aria-label="Hapus varian"
                  className="border-3 border-ink bg-secondary px-2 py-1.5 text-xs font-bold text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="mt-2 border-3 border-ink bg-white px-3 py-1.5 text-sm font-bold shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            + Tambah Varian
          </button>
        </div>

        {/* Foto Produk */}
        <div className="sm:col-span-2">
          <Label>Foto Produk (opsional)</Label>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-3 border-ink bg-paper shadow-brutal-sm">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Pratinjau" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl">🖼️</span>
              )}
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={onFile}
                className="block w-full border-3 border-ink bg-white p-2 text-sm font-medium file:mr-3 file:border-3 file:border-ink file:bg-main file:px-3 file:py-1 file:font-bold"
              />
              <Input
                name="imageUrl"
                defaultValue={product?.imageUrl ?? ""}
                onChange={(e) => setPreview(e.target.value.trim() || null)}
                placeholder="atau tempel URL gambar (https://...)"
                className="!text-sm"
              />
              <p className="text-xs font-medium text-ink/50">
                Unggah file (maks 4MB) atau tempel URL. Ukuran ideal ±600×600 px
                (persegi) atau 4:3; ditampilkan dipotong-tengah (object-cover), jadi
                taruh objek utama di tengah. Kosongkan untuk pakai ikon default.
              </p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="description">Deskripsi</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product?.description}
            placeholder="Jelaskan produk, durasi, garansi, dll."
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "+ Tambah Produk"}
      </Button>
    </form>
  );
}
