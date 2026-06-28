"use client";

import { useActionState, useEffect, useState } from "react";
import {
  startRegistrationAction,
  verifyRegistrationAction,
  resendRegistrationCodeAction,
} from "@/app/actions/auth";
import { Button, Input, Label, Alert } from "@/components/ui";
import Turnstile from "@/components/Turnstile";

export default function RegisterForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [startState, startAction, startPending] = useActionState(
    startRegistrationAction,
    undefined,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyRegistrationAction,
    undefined,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendRegistrationCodeAction,
    undefined,
  );

  const [phase, setPhase] = useState<"form" | "verify">("form");

  // Advance to the code step once step 1 succeeds.
  useEffect(() => {
    if (startState?.step === "verify") setPhase("verify");
  }, [startState]);

  const email = startState?.email ?? verifyState?.email ?? resendState?.email ?? "";

  if (phase === "verify") {
    return (
      <div className="space-y-4">
        <div className="border-3 border-ink bg-paper p-4">
          <p className="text-sm font-medium">
            Kami kirim kode 6 digit ke <b className="break-all">{email}</b>. Masukkan di
            bawah untuk menyelesaikan pendaftaran.
          </p>
        </div>

        {verifyState?.error && <Alert tone="error">{verifyState.error}</Alert>}
        {resendState?.resent && !verifyState?.error && (
          <Alert tone="success">Kode baru sudah dikirim ke emailmu.</Alert>
        )}
        {resendState?.error && <Alert tone="error">{resendState.error}</Alert>}

        <form action={verifyAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <div>
            <Label htmlFor="code">Kode Verifikasi</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="text-center font-display text-2xl tracking-[0.5em]"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={verifyPending}>
            {verifyPending ? "Memverifikasi..." : "Verifikasi & Buat Akun"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm font-medium">
          <form action={resendAction}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="brutal-link" disabled={resendPending}>
              {resendPending ? "Mengirim..." : "Kirim ulang kode"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setPhase("form")}
            className="text-ink/60 underline decoration-2 underline-offset-2"
          >
            ← Ubah data
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={startAction} className="space-y-4">
      {startState?.error && <Alert tone="error">{startState.error}</Alert>}

      <div>
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" placeholder="Nama kamu" required />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="kamu@email.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <Label htmlFor="phone">Nomor WhatsApp (opsional)</Label>
        <Input id="phone" name="phone" placeholder="0812xxxxxxx" autoComplete="tel" />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimal 6 karakter"
          autoComplete="new-password"
          required
        />
      </div>

      <Turnstile siteKey={turnstileSiteKey} />

      <Button type="submit" size="lg" className="w-full" disabled={startPending}>
        {startPending ? "Mengirim kode..." : "Daftar Sekarang"}
      </Button>
      <p className="text-center text-xs font-medium text-ink/50">
        Kami akan mengirim kode verifikasi ke emailmu.
      </p>
    </form>
  );
}
