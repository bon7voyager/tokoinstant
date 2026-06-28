"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveWithdrawalAction, rejectWithdrawalAction } from "@/app/actions/withdrawals";
import { Input } from "@/components/ui";

export default function WithdrawAdminActions({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<null | "approve" | "reject">(null);
  const router = useRouter();

  async function run(kind: "approve" | "reject") {
    const msg =
      kind === "approve"
        ? "Setujui penarikan ini? Pastikan dana sudah kamu transfer ke user."
        : "Tolak penarikan ini? Saldo akan dikembalikan ke user.";
    if (!confirm(msg)) return;
    setPending(kind);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("note", note);
    try {
      if (kind === "approve") await approveWithdrawalAction(fd);
      else await rejectWithdrawalAction(fd);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        className="!py-1.5 !text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => run("approve")}
          disabled={!!pending}
          className="border-3 border-ink bg-lime px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
        >
          {pending === "approve" ? "..." : "✓ Setujui"}
        </button>
        <button
          onClick={() => run("reject")}
          disabled={!!pending}
          className="border-3 border-ink bg-secondary px-3 py-1.5 text-xs font-bold uppercase text-white shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
        >
          {pending === "reject" ? "..." : "✕ Tolak"}
        </button>
      </div>
    </div>
  );
}
