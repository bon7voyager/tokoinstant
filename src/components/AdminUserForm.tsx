"use client";

import { useActionState } from "react";
import { adminUpdateUserAction } from "@/app/actions/admin";
import { Button, Input, Label, Select, Alert } from "@/components/ui";

type EditableUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "USER" | "ADMIN";
};

export default function AdminUserForm({ user }: { user: EditableUser }) {
  const [state, formAction, pending] = useActionState(adminUpdateUserAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="u-name">Nama</Label>
          <Input id="u-name" name="name" defaultValue={user.name} required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="u-email">Email</Label>
          <Input id="u-email" name="email" type="email" defaultValue={user.email} required />
        </div>
        <div>
          <Label htmlFor="u-phone">Nomor WhatsApp (opsional)</Label>
          <Input id="u-phone" name="phone" defaultValue={user.phone ?? ""} placeholder="0812xxxxxxx" />
        </div>
        <div>
          <Label htmlFor="u-role">Peran</Label>
          <Select id="u-role" name="role" defaultValue={user.role}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </form>
  );
}
