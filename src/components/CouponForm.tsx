"use client";

import { useActionState, useState } from "react";
import { createCouponAction, updateCouponAction } from "@/app/actions/coupons";
import { Button, Input, Label, Select, Alert } from "@/components/ui";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSpend: number;
  maxDiscount: number | null;
  quota: number | null;
  isActive: boolean;
  expiresAt: Date | null;
};

export default function CouponForm({ coupon }: { coupon?: Coupon }) {
  const isEdit = !!coupon;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateCouponAction : createCouponAction,
    undefined,
  );
  const [type, setType] = useState<"PERCENT" | "FIXED">(coupon?.type ?? "PERCENT");

  const expiresDefault = coupon?.expiresAt
    ? new Date(coupon.expiresAt).toISOString().slice(0, 10)
    : "";

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={coupon.id} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="code">Kode Kupon</Label>
          <Input
            id="code"
            name="code"
            defaultValue={coupon?.code}
            placeholder="HEMAT10"
            className="uppercase"
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Tipe</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
          >
            <option value="PERCENT">Persen (%)</option>
            <option value="FIXED">Potongan Tetap (Rp)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="value">{type === "PERCENT" ? "Nilai (%)" : "Nilai (Rp)"}</Label>
          <Input
            id="value"
            name="value"
            type="number"
            min={1}
            defaultValue={coupon?.value}
            placeholder={type === "PERCENT" ? "10" : "5000"}
            required
          />
        </div>
        <div>
          <Label htmlFor="minSpend">Min. Belanja (Rp)</Label>
          <Input
            id="minSpend"
            name="minSpend"
            type="number"
            min={0}
            defaultValue={coupon?.minSpend ?? 0}
            placeholder="0"
          />
        </div>
        {type === "PERCENT" && (
          <div>
            <Label htmlFor="maxDiscount">Maks. Potongan (Rp, opsional)</Label>
            <Input
              id="maxDiscount"
              name="maxDiscount"
              type="number"
              min={0}
              defaultValue={coupon?.maxDiscount ?? ""}
              placeholder="20000"
            />
          </div>
        )}
        <div>
          <Label htmlFor="quota">Kuota (opsional)</Label>
          <Input
            id="quota"
            name="quota"
            type="number"
            min={1}
            defaultValue={coupon?.quota ?? ""}
            placeholder="Kosong = tanpa batas"
          />
        </div>
        <div>
          <Label htmlFor="expiresAt">Kedaluwarsa (opsional)</Label>
          <Input id="expiresAt" name="expiresAt" type="date" defaultValue={expiresDefault} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={coupon?.isActive ?? true}
              className="h-5 w-5 border-3 border-ink accent-ink"
            />
            Aktif
          </label>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "+ Buat Kupon"}
      </Button>
    </form>
  );
}
