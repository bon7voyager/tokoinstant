"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { creditBalanceTx, debitBalanceTx, withdrawBounds, referralLockedBalance } from "@/lib/wallet";
import { formatIDR } from "@/lib/utils";

export type WithdrawState = { error?: string; success?: string } | undefined;

const withdrawSchema = z.object({
  amount: z.coerce.number().int().positive(),
  method: z.enum(["BANK", "EWALLET"]),
  accountName: z.string().trim().min(2, "Nama pemilik rekening wajib diisi"),
  accountNumber: z.string().trim().min(4, "Nomor rekening / e-wallet tidak valid"),
  note: z.string().trim().max(200).optional(),
});

/**
 * User requests a withdrawal. Funds are HELD immediately (race-safe debit) so
 * they can't be spent or withdrawn twice; admin then approves (pays out) or
 * rejects (refunds).
 */
export async function requestWithdrawalAction(
  _prev: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/withdraw");

  const parsed = withdrawSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    accountName: formData.get("accountName"),
    accountNumber: formData.get("accountNumber"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { amount, method, accountName, accountNumber, note } = parsed.data;
  const { min } = withdrawBounds();
  if (amount < min) return { error: `Minimal penarikan ${formatIDR(min)}.` };

  // Referral bonus can be spent on purchases but not cashed out: withdrawable excludes
  // the still-locked promo credit. (Friendly pre-check; the tx below is the real guard.)
  const locked = await referralLockedBalance(prisma, user.id);
  const withdrawable = user.balance - locked;
  if (amount > withdrawable) {
    return locked > 0
      ? {
          error: `Saldo yang bisa ditarik ${formatIDR(Math.max(0, withdrawable))}. ${formatIDR(
            locked,
          )} adalah bonus referral — bisa dipakai belanja, belum bisa ditarik.`,
        }
      : { error: "Saldo kamu tidak cukup." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Hold the funds (race-safe). Reserve the locked promo so it can't be cashed out.
      const reserve = await referralLockedBalance(tx, user.id);
      const bal = await debitBalanceTx(
        tx,
        user.id,
        amount,
        "WITHDRAWAL",
        `Penarikan ke ${method} ${accountNumber}`,
        null,
        reserve,
      );
      if (bal === null) throw new Error("INSUFFICIENT_BALANCE");

      await tx.withdrawal.create({
        data: {
          userId: user.id,
          amount,
          method,
          accountName,
          accountNumber,
          note: note || null,
          status: "PENDING",
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      return { error: "Saldo kamu tidak cukup." };
    }
    throw e;
  }

  revalidatePath("/dashboard/withdraw");
  revalidatePath("/dashboard");
  redirect("/dashboard/withdraw?success=1");
}

/* ------------------------------- Admin ------------------------------- */

export async function approveWithdrawalAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("note") ?? "").trim() || null;

  // Only a still-PENDING request can be approved (funds already held).
  await prisma.withdrawal.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED", adminNote, processedAt: new Date() },
  });

  revalidatePath("/admin/withdrawals");
}

export async function rejectWithdrawalAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const adminNote = String(formData.get("note") ?? "").trim() || "Ditolak admin";

  await prisma.$transaction(async (tx) => {
    // Flip PENDING -> REJECTED first (guards against double-refund).
    const upd = await tx.withdrawal.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", adminNote, processedAt: new Date() },
    });
    if (upd.count === 0) return; // already processed

    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
    // Return the held funds to the user's balance.
    await creditBalanceTx(
      tx,
      w.userId,
      w.amount,
      "REFUND",
      `Penarikan ditolak: ${adminNote}`,
      `ADMIN:${admin.id}`,
    );
  });

  revalidatePath("/admin/withdrawals");
}
