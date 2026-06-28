"use client";

import { useActionState, useEffect, useState } from "react";
import {
  requestPasswordResetAction,
  verifyResetCodeAction,
  resetPasswordAction,
  resendPasswordResetCodeAction,
} from "@/app/actions/password-reset";
import { Button, Input, Label, Alert } from "@/components/ui";
import Turnstile from "@/components/Turnstile";

export default function ForgotPasswordForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey: string;
}) {
  const [reqState, reqAction, reqPending] = useActionState(
    requestPasswordResetAction,
    undefined,
  );
  const [codeState, codeAction, codePending] = useActionState(
    verifyResetCodeAction,
    undefined,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    undefined,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendPasswordResetCodeAction,
    undefined,
  );

  const [phase, setPhase] = useState<"form" | "code" | "reset">("form");

  useEffect(() => {
    if (reqState?.step === "code") setPhase("code");
  }, [reqState]);
  useEffect(() => {
    if (codeState?.step === "reset") setPhase("reset");
    else if (codeState?.step === "code") setPhase("code");
  }, [codeState]);
  useEffect(() => {
    if (resetState?.step === "code") setPhase("code");
  }, [resetState]);

  const email =
    reqState?.email ?? codeState?.email ?? resetState?.email ?? resendState?.email ?? "";
  const code = codeState?.code ?? resetState?.code ?? "";

  // ---- Step 3: new password (code already validated) ----
  if (phase === "reset") {
    return (
      <div className="space-y-4">
        <div className="border-3 border-ink bg-lime p-4">
          <p className="text-sm font-bold">✓ Kode valid. Buat password baru di bawah.</p>
        </div>

        {resetState?.error && <Alert tone="error">{resetState.error}</Alert>}

        <form action={resetAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="code" value={code} />
          <div>
            <Label htmlFor="password">Password Baru</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">Ulangi Password Baru</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="Ketik ulang password"
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={resetPending}>
            {resetPending ? "Menyimpan..." : "Simpan Password Baru"}
          </Button>
        </form>
      </div>
    );
  }

  // ---- Step 2: enter the code ----
  if (phase === "code") {
    return (
      <div className="space-y-4">
        <div className="border-3 border-ink bg-paper p-4">
          <p className="text-sm font-medium">
            Kalau <b className="break-all">{email}</b> terdaftar, kami kirim kode 6 digit ke
            sana. Masukkan kodenya untuk lanjut.
          </p>
        </div>

        {codeState?.error && <Alert tone="error">{codeState.error}</Alert>}
        {resendState?.resent && !codeState?.error && (
          <Alert tone="success">Kode baru sudah dikirim (jika email terdaftar).</Alert>
        )}
        {resendState?.error && <Alert tone="error">{resendState.error}</Alert>}

        <form action={codeAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <div>
            <Label htmlFor="code">Kode Reset</Label>
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
          <Button type="submit" size="lg" className="w-full" disabled={codePending}>
            {codePending ? "Memeriksa..." : "Lanjut"}
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
            ← Ganti email
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 1: email ----
  return (
    <form action={reqAction} className="space-y-4">
      {reqState?.error && <Alert tone="error">{reqState.error}</Alert>}

      <div>
        <Label htmlFor="email">Email Akun</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="kamu@email.com"
          autoComplete="email"
          required
        />
      </div>

      <Turnstile siteKey={turnstileSiteKey} />

      <Button type="submit" size="lg" className="w-full" disabled={reqPending}>
        {reqPending ? "Mengirim kode..." : "Kirim Kode Reset"}
      </Button>
      <p className="text-center text-xs font-medium text-ink/50">
        Kami akan mengirim kode reset ke email akunmu.
      </p>
    </form>
  );
}
