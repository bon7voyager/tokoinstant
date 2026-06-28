"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button, Input, Label, Alert } from "@/components/ui";
import Turnstile from "@/components/Turnstile";

export default function LoginForm({
  next,
  turnstileSiteKey,
}: {
  next?: string;
  turnstileSiteKey: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}

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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      <Turnstile siteKey={turnstileSiteKey} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Masuk..." : "Masuk"}
      </Button>
    </form>
  );
}
