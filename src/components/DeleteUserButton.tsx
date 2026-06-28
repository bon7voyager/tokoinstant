"use client";

import { useEffect, useState } from "react";
import { deleteUserAction } from "@/app/actions/admin";
import { Button, Input } from "@/components/ui";

/**
 * Delete a buyer account behind a strong "type-to-confirm" modal: the admin must
 * type the exact account name before the delete button enables — so an account
 * can't be removed by an accidental click.
 */
export default function DeleteUserButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  const match = typed.trim() === name.trim();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setTyped("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-3 border-ink bg-secondary px-2 py-1 text-xs font-bold uppercase text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        Hapus
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md border-3 border-ink bg-white p-6 text-left shadow-brutal-lg">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border-3 border-ink bg-secondary text-2xl">
                ⚠️
              </span>
              <div>
                <h3 className="font-display text-xl leading-tight">Hapus Akun Ini?</h3>
                <p className="mt-1 text-sm font-medium text-ink/70">
                  Akun <b>{name}</b> beserta <b>semua datanya</b> (pesanan, saldo,
                  riwayat, penarikan) akan dihapus <b>permanen</b>. Tindakan ini{" "}
                  <b>tidak bisa dibatalkan</b>.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-bold">
                Ketik nama akun untuk konfirmasi:
              </label>
              <div className="mb-2 select-none border-3 border-ink bg-paper px-3 py-1.5 font-mono text-sm font-bold">
                {name}
              </div>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Ketik nama persis di atas"
                autoFocus
                aria-label="Konfirmasi nama akun"
              />
            </div>

            <form
              action={deleteUserAction}
              onSubmit={() => setPending(true)}
              className="mt-5 flex justify-end gap-2"
            >
              <input type="hidden" name="id" value={id} />
              <button
                type="button"
                onClick={close}
                className="border-3 border-ink bg-white px-4 py-2 text-sm font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                Batal
              </button>
              <Button type="submit" variant="secondary" size="sm" disabled={!match || pending}>
                {pending ? "Menghapus..." : "Hapus Permanen"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
