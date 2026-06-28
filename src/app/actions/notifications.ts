"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyOrderCompleted } from "@/lib/notify";

/**
 * Re-send a notification. For order-linked notifications it re-runs the
 * order-completed notifier (re-resolving the current recipient). Records a new row.
 */
export async function resendNotificationAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) return;

  if (notif.orderId && notif.template === "order_completed") {
    try {
      await notifyOrderCompleted(notif.orderId);
    } catch (e) {
      console.error("[notify] resend failed", e);
    }
  }

  revalidatePath("/admin/notifications");
}
