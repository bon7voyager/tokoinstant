"use client";

import { useActionState, useState } from "react";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  saveCallbackAction,
} from "@/app/actions/reseller-api";
import { Button, Input, Label, Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type KeyRow = {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

function CopyBox({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <code
        className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap border-3 border-ink bg-paper px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
        className="shrink-0 border-3 border-ink bg-main px-3 py-2 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        {copied ? "Tersalin!" : "Salin"}
      </button>
    </div>
  );
}

export default function ResellerApiPanel({
  keys,
  callbackUrl,
  callbackSecret,
}: {
  keys: KeyRow[];
  callbackUrl: string | null;
  callbackSecret: string | null;
}) {
  const [keyState, createAction, creating] = useActionState(createApiKeyAction, undefined);
  const [cbState, cbAction, cbPending] = useActionState(saveCallbackAction, undefined);

  return (
    <div className="space-y-6">
      {/* API keys */}
      <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
        <h2 className="font-display text-xl">🔑 API Key</h2>
        <p className="mt-1 text-sm font-medium text-ink/60">
          Pakai key ini di header <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>.
          Kunci penuh hanya ditampilkan sekali saat dibuat.
        </p>

        {keyState?.error && <Alert tone="error">{keyState.error}</Alert>}
        {keyState?.fullKey && (
          <div className="mt-4 border-3 border-ink bg-lime/40 p-3">
            <div className="mb-1.5 text-xs font-bold uppercase">
              ⚠️ Salin sekarang — tidak akan ditampilkan lagi
            </div>
            <CopyBox value={keyState.fullKey} />
          </div>
        )}

        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="label">Label key baru</Label>
            <Input id="label" name="label" placeholder="mis. Toko Reseller A" maxLength={40} />
          </div>
          <Button type="submit" variant="grape" disabled={creating}>
            {creating ? "Membuat…" : "+ Buat API Key"}
          </Button>
        </form>

        <div className="mt-5 overflow-x-auto border-3 border-ink">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b-3 border-ink bg-paper">
              <tr className="font-bold uppercase">
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Terakhir dipakai</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center font-medium text-ink/50">
                    Belum ada API key.
                  </td>
                </tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-3 py-2 font-bold">{k.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/60">{k.prefix}…</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink/60">
                    {k.lastUsedAt ? formatDate(k.lastUsedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={revokeApiKeyAction} className="inline">
                      <input type="hidden" name="id" value={k.id} />
                      <button className="border-3 border-ink bg-secondary px-2 py-1 text-xs font-bold uppercase text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                        Cabut
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Webhook callback */}
      <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
        <h2 className="font-display text-xl">📨 Webhook (Callback)</h2>
        <p className="mt-1 text-sm font-medium text-ink/60">
          Kami POST update order ke URL ini (status berubah / akun terkirim). Body
          ditandatangani HMAC-SHA256 di header <code className="font-mono">x-kilat-signature</code>.
        </p>

        {cbState?.error && <Alert tone="error">{cbState.error}</Alert>}
        {cbState?.success && <Alert tone="success">{cbState.success}</Alert>}

        <form action={cbAction} className="mt-4 space-y-2">
          <Label htmlFor="apiCallbackUrl">URL Webhook (kosongkan untuk menonaktifkan)</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id="apiCallbackUrl"
              name="apiCallbackUrl"
              type="url"
              defaultValue={callbackUrl ?? ""}
              placeholder="https://tokokamu.com/webhook/kilat"
              className="min-w-[220px] flex-1"
            />
            <Button type="submit" variant="grape" disabled={cbPending}>
              {cbPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>

        {callbackSecret && (
          <div className="mt-4">
            <Label>Signing Secret (untuk verifikasi tanda tangan)</Label>
            <CopyBox value={callbackSecret} />
            <p className="mt-1 text-xs font-medium text-ink/50">
              Verifikasi: <code className="font-mono">HMAC_SHA256(secret, body) === x-kilat-signature</code>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
