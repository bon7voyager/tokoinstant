"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { getPaymentProvider, isSimulation } from "@/lib/payment";
import { isPremium, premiumConfig } from "@/lib/membership";
import { settleMembershipTransaction, extendFrom } from "@/lib/membership-settle";
import { notifyMembershipActive } from "@/lib/notify";
import type { GatewayStartState } from "@/app/actions/payments";

export type MembershipState = { error?: string; success?: string } | undefined;

/**
 * Step 1 — user asks to upgrade. We DON'T charge here; we create (or reuse) a
 * PENDING purchase and send the user to a confirm page to pick a payment method.
 */
export async function requestMembershipUpgradeAction(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  void formData;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/upgrade");

  if (isPremium(user)) {
    return {
      error:
        "Kamu masih reseller aktif. Bisa upgrade lagi setelah masa berlaku habis.",
    };
  }

  const { fee, days } = premiumConfig();

  // Reuse an existing pending purchase so a user can't pile up duplicates. Even if
  // a race slips two through, settlement is stack-safe (see membership-settle.ts).
  const existing = await prisma.membershipPurchase.findFirst({
    where: { userId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const purchase = existing
    ? await prisma.membershipPurchase.update({
        where: { id: existing.id },
        data: { amount: fee, days }, // refresh in case config changed
      })
    : await prisma.membershipPurchase.create({
        data: { userId: user.id, amount: fee, days, status: "PENDING" },
      });

  redirect(`/dashboard/upgrade/${purchase.id}`);
}

/** Loads a pending purchase owned by the current user, with shared guards. */
async function loadPayablePurchase(purchaseId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/upgrade");

  const purchase = await prisma.membershipPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.userId !== user.id) {
    return { error: "Pembelian tidak ditemukan." as const };
  }
  if (purchase.status !== "PENDING") {
    return { error: "Pembelian ini sudah diproses." as const };
  }
  if (isPremium(user)) {
    return { error: "Kamu sudah jadi reseller aktif." as const };
  }
  return { user, purchase };
}

/** Step 2a — pay the membership fee from wallet balance. */
export async function payMembershipBalanceAction(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const loaded = await loadPayablePurchase(String(formData.get("purchaseId") ?? ""));
  if ("error" in loaded) return { error: loaded.error };

  let settled;
  try {
    settled = await settleMembershipTransaction(loaded.purchase.id, {
      useBalance: true,
      paymentRef: `BAL-${loaded.purchase.id}`,
      payMethod: "BALANCE",
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") {
      return { error: "Saldo tidak cukup. Pilih bayar langsung, atau top up dulu." };
    }
    if (e instanceof Error && e.message === "ALREADY_PREMIUM") {
      return { error: "Kamu sudah jadi reseller aktif." };
    }
    throw e;
  }

  if (settled) {
    try {
      await notifyMembershipActive(settled);
    } catch (e) {
      console.error("[notify] membership failed", e);
    }
  }

  revalidatePath("/dashboard/upgrade");
  revalidatePath("/dashboard");
  redirect("/dashboard/upgrade?success=1");
}

/** Step 2b (simulation only) — settle the gateway payment instantly. */
export async function payMembershipGatewayAction(
  _prev: MembershipState,
  formData: FormData,
): Promise<MembershipState> {
  const loaded = await loadPayablePurchase(String(formData.get("purchaseId") ?? ""));
  if ("error" in loaded) return { error: loaded.error };
  // Instant settle is only valid in simulation; with a real provider the buyer must
  // actually pay (webhook settles). Guard server-side — the action is POST-invokable.
  if (!isSimulation()) {
    return { error: "Silakan lanjutkan ke pembayaran gateway." };
  }

  const settled = await settleMembershipTransaction(loaded.purchase.id, {
    useBalance: false,
    paymentRef: `SIM-MEM-${Date.now()}`,
    payMethod: "GATEWAY",
  });

  if (settled) {
    try {
      await notifyMembershipActive(settled);
    } catch (e) {
      console.error("[notify] membership failed", e);
    }
  }

  revalidatePath("/dashboard/upgrade");
  revalidatePath("/dashboard");
  redirect("/dashboard/upgrade?success=1");
}

/** Step 2b (real gateway) — create a charge; webhook activates on success. */
export async function startMembershipGatewayAction(
  _prev: GatewayStartState,
  formData: FormData,
): Promise<GatewayStartState> {
  const loaded = await loadPayablePurchase(String(formData.get("purchaseId") ?? ""));
  if ("error" in loaded) return { error: loaded.error };
  if (isSimulation()) {
    return { error: "Mode simulasi aktif — gunakan tombol bayar simulasi." };
  }

  const { user, purchase } = loaded;
  const provider = getPaymentProvider();
  let charge;
  try {
    charge = await provider.createCharge({
      purpose: "MEMBERSHIP",
      merchantRef: `MEM-${purchase.id}`,
      amount: purchase.amount,
      customer: { name: user.name, email: user.email, phone: user.phone },
      itemName: `Membership Reseller (${purchase.days} hari)`,
    });
  } catch (e) {
    console.error("[payment] membership createCharge failed", e);
    return { error: "Gagal membuat transaksi pembayaran. Coba lagi." };
  }

  await prisma.membershipPurchase.update({
    where: { id: purchase.id },
    data: { paymentRef: charge.ref },
  });

  if (charge.redirectUrl) redirect(charge.redirectUrl);

  return {
    instruction: {
      qrString: charge.qrString,
      qrImageUrl: charge.qrImageUrl,
      payCode: charge.payCode,
    },
  };
}

/* ------------------------------- Admin ------------------------------- */

export async function adminGrantPremiumAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const { days } = premiumConfig();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true },
  });
  if (!user) return;
  const wasActive = isPremium(user);
  await prisma.user.update({
    where: { id: userId },
    data: { premiumUntil: extendFrom(user.premiumUntil, days) },
  });
  await prisma.membershipLog.create({
    data: {
      userId,
      action: "GRANT",
      days,
      adminId: admin.id,
      note: wasActive ? "Perpanjang membership oleh admin" : "Aktivasi membership oleh admin",
    },
  });
  revalidatePath(`/admin/users/${userId}/edit`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/membership");
}

export async function adminRevokePremiumAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { premiumUntil: null } });
  await prisma.membershipLog.create({
    data: {
      userId,
      action: "REVOKE",
      adminId: admin.id,
      note: "Membership dicabut oleh admin",
    },
  });
  revalidatePath(`/admin/users/${userId}/edit`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/membership");
}
