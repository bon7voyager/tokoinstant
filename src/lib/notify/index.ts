import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationStatus } from "@prisma/client";
import type { SendNotificationInput } from "./types";
import {
  resolveEmailProvider,
  resolveWhatsAppProvider,
  notifyEnabled,
  logBodyMode,
} from "./config";
import { renderTemplate } from "./templates";
import { normalizePhoneID } from "./phone";
import { redactSecrets, redactPayload } from "./redact";

export { notifyStatus } from "./config";

async function record(args: {
  channel: SendNotificationInput["channel"];
  template: string;
  to: string;
  status: NotificationStatus;
  subject?: string | null;
  body: string;
  payload?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  error?: string | null;
  userId?: string | null;
  orderId?: string | null;
}) {
  const row = await prisma.notification.create({
    data: {
      channel: args.channel,
      template: args.template,
      to: args.to,
      status: args.status,
      subject: args.subject ?? null,
      body: args.body,
      payload: args.payload ?? null,
      provider: args.provider ?? null,
      providerRef: args.providerRef ?? null,
      error: args.error ?? null,
      userId: args.userId ?? null,
      orderId: args.orderId ?? null,
    },
    select: { id: true, status: true },
  });
  return row;
}

/**
 * Core notification entrypoint. ALWAYS records a Notification row; dispatches via
 * the configured provider when available, otherwise records status LOGGED.
 * Never throws on dispatch failure — returns the recorded row.
 */
export async function sendNotification(
  input: SendNotificationInput,
): Promise<{ id: string; status: NotificationStatus }> {
  const rendered = renderTemplate(input.template, input.data);
  const secrets = input.secrets ?? [];

  // "Automated, do not reply" notice appended to every EMAIL's plaintext (the HTML
  // version lives in the template shell). WhatsApp (waText) is left replyable.
  const emailText =
    rendered.text +
    "\n\n—\nEmail otomatis dari Kilat, mohon jangan dibalas. Butuh bantuan? Buka kilat.shop/kontak.";

  // 1. Resolve destination
  let to = input.to;
  if (input.channel === "WHATSAPP") {
    const norm = normalizePhoneID(to);
    if (!norm) {
      return record({
        channel: input.channel,
        template: input.template,
        to: input.to || "-",
        status: "FAILED",
        body: rendered.waText,
        error: "invalid_phone",
        userId: input.userId,
        orderId: input.orderId,
      });
    }
    to = norm;
  }

  // 2. Body to store (redacted if configured)
  const rawBody = input.channel === "EMAIL" ? emailText : rendered.waText;
  const storeBody =
    logBodyMode() === "redacted" ? redactSecrets(rawBody, secrets) : rawBody;
  const storePayload =
    logBodyMode() === "redacted"
      ? redactPayload(input.data, secrets)
      : JSON.stringify(input.data);

  // 3. Resolve provider
  const provider =
    input.channel === "EMAIL" ? resolveEmailProvider() : resolveWhatsAppProvider();

  if (!provider || !notifyEnabled()) {
    return record({
      channel: input.channel,
      template: input.template,
      to,
      status: "LOGGED",
      provider: null,
      subject: rendered.subject,
      body: storeBody,
      payload: storePayload,
      userId: input.userId,
      orderId: input.orderId,
    });
  }

  // 4. Dispatch
  let result;
  try {
    result =
      input.channel === "EMAIL"
        ? await (provider as ReturnType<typeof resolveEmailProvider>)!.send({
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: emailText,
          })
        : await (provider as ReturnType<typeof resolveWhatsAppProvider>)!.send({
            to,
            message: rendered.waText,
          });
  } catch (e) {
    result = {
      ok: false,
      provider: provider.name,
      error: e instanceof Error ? e.message : "dispatch_failed",
    };
  }

  return record({
    channel: input.channel,
    template: input.template,
    to,
    status: result.ok ? "SENT" : "FAILED",
    provider: result.provider,
    providerRef: result.providerRef ?? null,
    error: result.ok ? null : (result.error ?? "dispatch_failed"),
    subject: rendered.subject,
    body: storeBody,
    payload: storePayload,
    userId: input.userId,
    orderId: input.orderId,
  });
}

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("[notify] dispatch error", e);
  }
}

/** Loads the order and notifies via email (+ WhatsApp if phone set). Never throws. */
export async function notifyOrderCompleted(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, deliveredStocks: true },
  });
  if (!order || order.status !== "COMPLETED") return;

  // Only the live (non-superseded) credentials.
  const liveStocks = order.deliveredStocks.filter((s) => !s.replacedAt);
  const secrets = liveStocks.map((s) => s.secret);
  const data = {
    name: order.user.name,
    productName: order.product.name,
    orderNumber: order.orderNumber,
    total: order.total,
    credentials: liveStocks.map((s) => ({ secret: s.secret, note: s.note })),
  };

  await safe(() =>
    sendNotification({
      to: order.user.email,
      channel: "EMAIL",
      template: "order_completed",
      data,
      userId: order.userId,
      orderId: order.id,
      secrets,
    }),
  );

  if (order.user.phone) {
    await safe(() =>
      sendNotification({
        to: order.user.phone!,
        channel: "WHATSAPP",
        template: "order_completed",
        data,
        userId: order.userId,
        orderId: order.id,
        secrets,
      }),
    );
  }
}

/**
 * Notify the store admin(s) that a new PAID order came in. Sends to every
 * ADMIN-role user's email. Disable with NOTIFY_ADMIN_ORDERS="false". Never throws.
 */
export async function notifyAdminNewOrder(orderId: string): Promise<void> {
  if (process.env.NOTIFY_ADMIN_ORDERS === "false") return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true },
  });
  if (!order || (order.status !== "PAID" && order.status !== "COMPLETED")) return;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  if (admins.length === 0) return;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_BASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const data = {
    orderNumber: order.orderNumber,
    productName: order.product.name + (order.variantName ? ` — ${order.variantName}` : ""),
    total: order.total,
    buyerName: order.user.name,
    buyerEmail: order.user.email,
    payMethod: order.payMethod,
    needsAction: order.status === "PAID", // manual products sit at PAID awaiting delivery
    adminUrl: base ? `${base}/admin/orders/${order.id}` : "",
  };

  for (const a of admins) {
    await safe(() =>
      sendNotification({
        to: a.email,
        channel: "EMAIL",
        template: "admin_new_order",
        data,
        orderId: order.id,
      }),
    );
  }
}

/** Notify a successful top-up. Never throws. */
export async function notifyTopupSuccess(args: {
  userId: string;
  nominal: number;
  newBalance: number;
  ref?: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) return;
  const data = {
    name: user.name,
    nominal: args.nominal,
    newBalance: args.newBalance,
    ref: args.ref,
  };

  await safe(() =>
    sendNotification({
      to: user.email,
      channel: "EMAIL",
      template: "topup_success",
      data,
      userId: user.id,
    }),
  );
  if (user.phone) {
    await safe(() =>
      sendNotification({
        to: user.phone!,
        channel: "WHATSAPP",
        template: "topup_success",
        data,
        userId: user.id,
      }),
    );
  }
}

/** Notify a user that their reseller membership is now active. Never throws. */
export async function notifyMembershipActive(args: {
  userId: string;
  days: number;
  premiumUntil: Date;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: args.userId } });
  if (!user) return;
  const { formatDate } = await import("@/lib/utils");
  const { resellerPercent } = await import("@/lib/membership");
  const data = {
    name: user.name,
    days: args.days,
    until: formatDate(args.premiumUntil),
    percent: resellerPercent(),
  };

  await safe(() =>
    sendNotification({
      to: user.email,
      channel: "EMAIL",
      template: "membership_active",
      data,
      userId: user.id,
    }),
  );
  if (user.phone) {
    await safe(() =>
      sendNotification({
        to: user.phone!,
        channel: "WHATSAPP",
        template: "membership_active",
        data,
        userId: user.id,
      }),
    );
  }
}

/** Notify the buyer that payment was received and a MANUAL order is being processed. Never throws. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true },
  });
  if (!order || order.status !== "PAID") return;

  const data = {
    name: order.user.name,
    productName: order.product.name,
    orderNumber: order.orderNumber,
    total: order.total,
  };

  await safe(() =>
    sendNotification({
      to: order.user.email,
      channel: "EMAIL",
      template: "order_paid",
      data,
      userId: order.userId,
      orderId: order.id,
    }),
  );
  if (order.user.phone) {
    await safe(() =>
      sendNotification({
        to: order.user.phone!,
        channel: "WHATSAPP",
        template: "order_paid",
        data,
        userId: order.userId,
        orderId: order.id,
      }),
    );
  }
}

/** Notify the buyer their order was refunded. Never throws. */
export async function notifyOrderRefunded(orderId: string, reason: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });
  if (!order) return;
  const data = {
    name: order.user.name,
    orderNumber: order.orderNumber,
    total: order.total,
    reason,
  };
  await safe(() =>
    sendNotification({
      to: order.user.email,
      channel: "EMAIL",
      template: "order_refunded",
      data,
      userId: order.userId,
      orderId: order.id,
    }),
  );
  if (order.user.phone) {
    await safe(() =>
      sendNotification({
        to: order.user.phone!,
        channel: "WHATSAPP",
        template: "order_refunded",
        data,
        userId: order.userId,
        orderId: order.id,
      }),
    );
  }
}

/** Notify the buyer of warranty replacement credentials. Never throws. */
export async function notifyOrderWarranty(
  orderId: string,
  newSecrets: string[],
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true },
  });
  if (!order) return;
  const data = {
    name: order.user.name,
    productName: order.product.name,
    orderNumber: order.orderNumber,
    credentials: newSecrets.map((secret) => ({ secret, note: "Akun pengganti" })),
  };
  await safe(() =>
    sendNotification({
      to: order.user.email,
      channel: "EMAIL",
      template: "order_warranty",
      data,
      userId: order.userId,
      orderId: order.id,
      secrets: newSecrets,
    }),
  );
  if (order.user.phone) {
    await safe(() =>
      sendNotification({
        to: order.user.phone!,
        channel: "WHATSAPP",
        template: "order_warranty",
        data,
        userId: order.userId,
        orderId: order.id,
        secrets: newSecrets,
      }),
    );
  }
}

/** Send a 6-digit email-verification code to a not-yet-registered address.
 * Code is intentionally NOT redacted in the stored body so it stays usable in
 * dev (status LOGGED) / readable by the operator if no provider is configured. */
export async function notifyEmailVerification(args: {
  email: string;
  code: string;
  minutes?: number;
}): Promise<void> {
  await safe(() =>
    sendNotification({
      to: args.email,
      channel: "EMAIL",
      template: "email_verify",
      data: { code: args.code, minutes: args.minutes ?? 10 },
    }),
  );
}

/** Send a 6-digit password-reset code. Like email_verify, the code is NOT redacted
 * in the stored body so it stays usable/readable when no provider is configured. */
export async function notifyPasswordReset(args: {
  email: string;
  code: string;
  minutes?: number;
}): Promise<void> {
  await safe(() =>
    sendNotification({
      to: args.email,
      channel: "EMAIL",
      template: "password_reset",
      data: { code: args.code, minutes: args.minutes ?? 10 },
    }),
  );
}

/** Send auto-created (guest) account credentials via email + WhatsApp. The
 * password IS passed as a secret so it's redacted in the stored notification
 * body (still sent in full to the provider). Never throws. */
export async function notifyAccountCreated(args: {
  userId: string;
  email: string;
  phone?: string | null;
  name: string;
  password: string;
  loginUrl?: string;
}): Promise<void> {
  const data = {
    name: args.name,
    email: args.email,
    password: args.password,
    loginUrl: args.loginUrl ?? "/login",
  };
  await safe(() =>
    sendNotification({
      to: args.email,
      channel: "EMAIL",
      template: "account_created",
      data,
      userId: args.userId,
      secrets: [args.password],
    }),
  );
  if (args.phone) {
    await safe(() =>
      sendNotification({
        to: args.phone!,
        channel: "WHATSAPP",
        template: "account_created",
        data,
        userId: args.userId,
        secrets: [args.password],
      }),
    );
  }
}

/** Optional: notify on order creation (PENDING). Never throws. */
export async function notifyOrderCreated(orderId: string): Promise<void> {
  if (process.env.NOTIFY_ON_ORDER_CREATED !== "true") return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true },
  });
  if (!order) return;
  const data = {
    name: order.user.name,
    productName: order.product.name,
    orderNumber: order.orderNumber,
    total: order.total,
  };
  await safe(() =>
    sendNotification({
      to: order.user.email,
      channel: "EMAIL",
      template: "order_created",
      data,
      userId: order.userId,
      orderId: order.id,
    }),
  );
}
