"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { Button, Input, Label, Alert } from "@/components/ui";

export default function ProfileForm({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div>
        <Label htmlFor="p-name">Nama</Label>
        <Input id="p-name" name="name" defaultValue={name} required />
      </div>
      <div>
        <Label htmlFor="p-email">Email</Label>
        <Input id="p-email" name="email" type="email" defaultValue={email} required />
      </div>
      <div>
        <Label htmlFor="p-phone">Nomor WhatsApp (opsional)</Label>
        <Input
          id="p-phone"
          name="phone"
          defaultValue={phone ?? ""}
          placeholder="0812xxxxxxx"
        />
        <p className="mt-1 text-xs font-medium text-ink/50">
          Untuk menerima akun & notifikasi lewat WhatsApp.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Profil"}
      </Button>
    </form>
  );
}
