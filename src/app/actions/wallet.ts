"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { creditBalanceTx, debitBalanceTx, topupBounds } from "@/lib/wallet";
import { getPaymentProvider, isSimulation } from "@/lib/payment";
import { notifyTopupSuccess } from "@/lib/notify";
import { formatIDR } from "@/lib/utils";
import { settleTopUpTransaction } from "@/lib/topup-settle";

export type WalletState =
  | { error?: string; success?: string; tone?: "success" | "error" }
  | undefined;

export async function requestTopUpAction(
  _prev: WalletState,
  formData: FormData,
): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/topup");

  const amount = Math.floor(Number(formData.get("amount") ?? 0));
  const { min, max } = topupBounds();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Nominal top up tidak valid." };
  }
  if (amount < min) return { error: `Minimal top up ${formatIDR(min)}.` };
  if (amount > max) return { error: `Maksimal top up ${formatIDR(max)}.` };

  const topUp = await prisma.topUp.create({
    data: { userId: user.id, amount, status: "PENDING" },
  });

  // Simulation: go to a 2-step confirm page (saldo only credited after confirm).
  if (isSimulation()) {
    redirect(`/dashboard/topup/${topUp.id}`);
  }

  // Real gateway: create a charge and send the buyer to the hosted payment page.
  const provider = getPaymentProvider();
  let charge;
  try {
    charge = await provider.createCharge({
      purpose: "TOPUP",
      merchantRef: `TOP-${topUp.id}`,
      amount,
      customer: { name: user.name, email: user.email, phone: user.phone },
      itemName: `Top Up Saldo ${formatIDR(amount)}`,
    });
  } catch (e) {
    console.error("[payment] topup createCharge failed", e);
    await prisma.topUp.update({ where: { id: topUp.id }, data: { status: "FAILED" } });
    return { error: "Gagal membuat transaksi pembayaran. Coba lagi." };
  }

  await prisma.topUp.update({
    where: { id: topUp.id },
    data: { paymentRef: charge.ref },
  });

  if (charge.redirectUrl) redirect(charge.redirectUrl);
  redirect(`/dashboard/topup/${topUp.id}`);
}

/**
 * Confirm a simulated top-up payment: credit the balance and notify.
 * (In real-gateway mode the webhook does this instead.)
 */
export async function payTopUpAction(
  _prev: WalletState,
  formData: FormData,
): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/topup");

  const topUpId = String(formData.get("topUpId") ?? "");
  const topUp = await prisma.topUp.findUnique({ where: { id: topUpId } });
  if (!topUp || topUp.userId !== user.id) {
    return { error: "Top up tidak ditemukan." };
  }
  if (topUp.status !== "PENDING") {
    return { error: "Top up ini sudah diproses." };
  }

  const settled = await settleTopUpTransaction(topUp.id, `SIM-TOP-${Date.now()}`);
  if (settled) {
    try {
      await notifyTopupSuccess({
        userId: settled.userId,
        nominal: settled.amount,
        newBalance: settled.newBalance,
        ref: topUp.id,
      });
    } catch (e) {
      console.error("[notify] topup failed", e);
    }
  }

  revalidatePath("/dashboard/topup");
  revalidatePath("/dashboard");
  redirect("/dashboard/topup?success=1");
}

export async function adminAdjustBalanceAction(
  _prev: WalletState,
  formData: FormData,
): Promise<WalletState> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const amount = Math.floor(Number(formData.get("amount") ?? 0));
  const note = String(formData.get("note") ?? "").trim();

  if (!userId) return { error: "User tidak valid." };
  if (!Number.isFinite(amount) || amount === 0)
    return { error: "Nominal tidak boleh 0." };
  if (Math.abs(amount) > 1_000_000_000)
    return { error: "Nominal terlalu besar." };
  if (!note) return { error: "Catatan wajib diisi." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User tidak ditemukan." };

  const ref = `ADMIN:${admin.id}`;
  try {
    await prisma.$transaction(async (tx) => {
      if (amount > 0) {
        await creditBalanceTx(tx, userId, amount, "ADJUSTMENT", note, ref);
      } else {
        const res = await debitBalanceTx(tx, userId, -amount, "ADJUSTMENT", note, ref);
        if (res === null) throw new Error("INSUFFICIENT");
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT") {
      return { error: "Saldo user tidak cukup untuk pengurangan ini." };
    }
    throw e;
  }

  revalidatePath("/admin/balances");
  revalidatePath(`/admin/users/${userId}/edit`);
  revalidatePath("/admin/transactions");
  return {
    success: `Saldo ${target.name} ${amount > 0 ? "ditambah" : "dikurangi"} ${formatIDR(Math.abs(amount))}.`,
    tone: amount > 0 ? "success" : "error",
  };
}
