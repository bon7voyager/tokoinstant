"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/app/actions/profile";
import { Button, Input, Label, Alert } from "@/components/ui";
import Turnstile from "@/components/Turnstile";

export default function ChangePasswordForm({
  hasPassword,
  turnstileSiteKey,
  redirectOnSuccess,
}: {
  hasPassword: boolean;
  turnstileSiteKey: string;
  redirectOnSuccess?: string; // where to go after a successful save (e.g. welcome flow)
}) {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);
  const router = useRouter();

  // After a successful save, optionally move the user along (used by the
  // post-Google "buat password" welcome page). Brief delay so they see the toast.
  useEffect(() => {
    if (state?.success && redirectOnSuccess) {
      const t = setTimeout(() => router.push(redirectOnSuccess), 900);
      return () => clearTimeout(t);
    }
  }, [state, redirectOnSuccess, router]);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {hasPassword && (
        <div>
          <Label htmlFor="cp-current">Password Saat Ini</Label>
          <Input
            id="cp-current"
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}
      <div>
        <Label htmlFor="cp-new">Password Baru</Label>
        <Input
          id="cp-new"
          name="password"
          type="password"
          placeholder="Minimal 6 karakter"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <Label htmlFor="cp-confirm">Ulangi Password Baru</Label>
        <Input
          id="cp-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} />}

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : hasPassword ? "Ganti Password" : "Buat Password"}
      </Button>
      {!hasPassword && (
        <p className="text-xs font-medium text-ink/50">
          Akunmu dibuat lewat Google. Buat password supaya bisa login manual juga.
        </p>
      )}
    </form>
  );
}
