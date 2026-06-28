"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { normalizePhoneID } from "@/lib/notify/phone";
import { notifyOrderCompleted } from "@/lib/notify";
import { fireResellerCallback } from "@/lib/reseller-callback";
import { processReferralReward } from "@/lib/referral";
import { saveUploadedImage } from "@/lib/upload";

export type AdminState = { error?: string; success?: string } | undefined;

/* ----------------------------- Products ----------------------------- */

const productSchema = z.object({
  name: z.string().min(2, "Nama produk minimal 2 karakter"),
  description: z.string().min(5, "Deskripsi terlalu pendek"),
  price: z.coerce.number().int().min(0, "Harga tidak valid"),
  categoryId: z.string().optional(),
  badge: z.string().optional(),
  warranty: z.string().optional(),
  fulfillment: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
});

/**
 * Resolve the product image from the form: an uploaded file wins; otherwise the
 * pasted URL/path; an empty field clears it; a missing field keeps `current`.
 * Uploaded files are saved under /public/uploads with a generated name (no
 * user-controlled path). Throws a coded error on invalid input.
 */
async function resolveProductImage(
  formData: FormData,
  current: string | null,
): Promise<string | null> {
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    return saveUploadedImage(file, "prod"); // validates type + 4MB, saves to /public/uploads
  }

  const raw = formData.get("imageUrl");
  if (raw === null) return current; // field absent -> keep
  const url = String(raw).trim();
  if (!url) return null; // explicit clear
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) throw new Error("INVALID_URL");
  return url;
}

function imageError(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "IMAGE_TOO_LARGE") return "Foto terlalu besar (maksimal 4MB).";
  if (m === "INVALID_IMAGE") return "File yang diunggah harus berupa gambar.";
  if (m === "INVALID_URL") return "URL gambar tidak valid (harus diawali http/https).";
  return "Gagal memproses foto produk.";
}

type IncomingVariant = { id?: string; name: string; price: number; isActive: boolean };

/** Parse the JSON variants payload from the product form (defensive). */
function parseVariants(raw: unknown): IncomingVariant[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v): IncomingVariant | null => {
      if (!v || typeof v !== "object") return null;
      const o = v as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      const price = Math.floor(Number(o.price));
      if (!name || !Number.isFinite(price) || price < 0) return null;
      return {
        id: typeof o.id === "string" && o.id ? o.id : undefined,
        name: name.slice(0, 60),
        price,
        isActive: o.isActive !== false,
      };
    })
    .filter((v): v is IncomingVariant => v !== null)
    .slice(0, 30);
}

/**
 * Reconcile a product's variants with the submitted list.
 *
 * The whole reconciliation runs in a single transaction so a mid-loop failure
 * can't leave the product half-synced (some variants deleted, others not) — and
 * on SQLite the write lock serialises this against checkout/settle, closing the
 * check-then-delete race where an order could commit between the order.count and
 * the delete. Dropped-variant stock is removed AVAILABLE-only, mirroring
 * deleteStockAction, so a buyer's delivered (SOLD) credential is never destroyed.
 */
async function syncVariants(productId: string, incoming: IncomingVariant[]) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });
    const keepIds = new Set(incoming.filter((v) => v.id).map((v) => v.id!));

    // Dropped variants: delete when no order history, else deactivate (preserve history).
    for (const e of existing) {
      if (keepIds.has(e.id)) continue;
      const orderCount = await tx.order.count({ where: { variantId: e.id } });
      if (orderCount > 0) {
        await tx.productVariant.update({ where: { id: e.id }, data: { isActive: false } });
      } else {
        // Only AVAILABLE units are removable; SOLD/delivered stock stays put
        // (the variant delete then SetNulls its variantId, keeping the credential).
        await tx.stock.deleteMany({ where: { variantId: e.id, status: "AVAILABLE" } });
        await tx.productVariant.delete({ where: { id: e.id } });
      }
    }

    // Upsert (array order becomes sortOrder).
    const existingIds = new Set(existing.map((e) => e.id));
    for (let i = 0; i < incoming.length; i++) {
      const v = incoming[i];
      const data = { name: v.name, price: v.price, isActive: v.isActive, sortOrder: i };
      if (v.id && existingIds.has(v.id)) {
        await tx.productVariant.update({ where: { id: v.id }, data });
      } else {
        await tx.productVariant.create({ data: { ...data, productId } });
      }
    }
  });
}

export async function createProductAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    categoryId: formData.get("categoryId") || undefined,
    badge: formData.get("badge") || undefined,
    warranty: formData.get("warranty") || undefined,
    fulfillment: formData.get("fulfillment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const instant = formData.get("instant") === "true";
  const isOfficial = formData.get("isOfficial") === "true";

  // Per-product reseller discount: blank = inherit the global default (null);
  // an explicit 0 disables the reseller discount for this product.
  const rpRaw = String(formData.get("resellerPercent") ?? "").trim();
  let resellerPercent: number | null = null;
  if (rpRaw !== "") {
    const n = Number(rpRaw);
    // Strict plain-decimal only: reject 0x/0b/0o/+/./e forms that Number() would
    // silently coerce to a different value (server actions take arbitrary input).
    if (!/^\d{1,2}$/.test(rpRaw) || n > 90) {
      return { error: "Diskon reseller harus angka 0–90." };
    }
    resellerPercent = n;
  }

  let imageUrl: string | null;
  try {
    imageUrl = await resolveProductImage(formData, null);
  } catch (e) {
    return { error: imageError(e) };
  }

  let slug = slugify(parsed.data.name);
  // ensure unique slug
  if (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const created = await prisma.product.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      price: parsed.data.price,
      categoryId: parsed.data.categoryId || null,
      badge: parsed.data.badge || null,
      warranty: parsed.data.warranty?.trim() || null,
      instant,
      isOfficial,
      fulfillment: parsed.data.fulfillment,
      resellerPercent,
      imageUrl,
    },
  });
  await syncVariants(created.id, parseVariants(formData.get("variants")));

  revalidatePath("/admin/products");
  revalidatePath("/");
  return { success: "Produk berhasil ditambahkan." };
}

export async function updateProductAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    categoryId: formData.get("categoryId") || undefined,
    badge: formData.get("badge") || undefined,
    warranty: formData.get("warranty") || undefined,
    fulfillment: formData.get("fulfillment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const instant = formData.get("instant") === "true";
  const isOfficial = formData.get("isOfficial") === "true";

  // Per-product reseller discount: blank = inherit the global default (null);
  // an explicit 0 disables the reseller discount for this product.
  const rpRaw = String(formData.get("resellerPercent") ?? "").trim();
  let resellerPercent: number | null = null;
  if (rpRaw !== "") {
    const n = Number(rpRaw);
    // Strict plain-decimal only: reject 0x/0b/0o/+/./e forms that Number() would
    // silently coerce to a different value (server actions take arbitrary input).
    if (!/^\d{1,2}$/.test(rpRaw) || n > 90) {
      return { error: "Diskon reseller harus angka 0–90." };
    }
    resellerPercent = n;
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  let imageUrl: string | null;
  try {
    imageUrl = await resolveProductImage(formData, existing?.imageUrl ?? null);
  } catch (e) {
    return { error: imageError(e) };
  }

  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      categoryId: parsed.data.categoryId || null,
      badge: parsed.data.badge || null,
      warranty: parsed.data.warranty?.trim() || null,
      instant,
      isOfficial,
      fulfillment: parsed.data.fulfillment,
      resellerPercent,
      imageUrl,
    },
  });
  await syncVariants(id, parseVariants(formData.get("variants")));

  revalidatePath("/admin/products");
  revalidatePath("/");
  return { success: "Produk diperbarui." };
}

export async function toggleProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const product = await prisma.product.findUnique({ where: { id } });
  if (product) {
    await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  // Block deletion if the product already has orders (keep history intact).
  const orderCount = await prisma.order.count({ where: { productId: id } });
  if (orderCount > 0) {
    // soft-disable instead of hard delete
    await prisma.product.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.product.delete({ where: { id } });
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
}

/* ------------------------------ Stock ------------------------------- */

export async function addStockAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const raw = String(formData.get("items") ?? "");
  const rawVariantId = String(formData.get("variantId") ?? "").trim();

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { select: { id: true, isActive: true } } },
  });
  if (!product) return { error: "Produk tidak ditemukan." };

  // A product that has ANY variants is variant-based: stock must be assigned to
  // an active variant, never the product-level (null) pool. We check all variants
  // (not just active) so stock added while every variant is deactivated can't land
  // in the null pool and become orphaned once a variant is reactivated.
  let variantId: string | null = null;
  if (product.variants.length > 0) {
    const activeVariants = product.variants.filter((v) => v.isActive);
    if (activeVariants.length === 0) {
      return { error: "Aktifkan dulu salah satu varian sebelum menambah stok." };
    }
    if (!rawVariantId || !activeVariants.some((v) => v.id === rawVariantId)) {
      return { error: "Pilih varian untuk stok ini." };
    }
    variantId = rawVariantId;
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: "Isi minimal satu baris stok." };

  await prisma.stock.createMany({
    data: lines.map((secret) => ({ productId, variantId, secret, note })),
  });

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { success: `${lines.length} stok berhasil ditambahkan.` };
}

export async function deleteStockAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  // only allow deleting stock that hasn't been sold
  await prisma.stock.deleteMany({ where: { id, status: "AVAILABLE" } });
  revalidatePath("/admin/stock");
}

/**
 * Move a product's leftover product-level (variantId = null) AVAILABLE stock into
 * one of its active variants. Lets an admin rescue stock that became unsellable
 * after variants were added to a product that already had stock. Only AVAILABLE,
 * null-pool units are touched — SOLD units (whose order references the variant)
 * and stock already on another variant are never moved.
 */
export async function assignStockToVariantAction(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  if (!productId || !variantId) return;

  // Target variant must belong to this product and be active.
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, isActive: true },
    select: { id: true },
  });
  if (!variant) return;

  await prisma.stock.updateMany({
    where: { productId, variantId: null, status: "AVAILABLE" },
    data: { variantId },
  });

  revalidatePath("/admin/stock");
  revalidatePath("/");
}

/* ------------------------------ Orders ------------------------------ */

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["PENDING", "PAID", "COMPLETED", "FAILED", "EXPIRED"];
  if (!allowed.includes(status)) return;
  await prisma.order.update({
    where: { id },
    data: {
      status: status as never,
      // Stamp the completion time on a direct flip so the rating window starts here.
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
  revalidatePath("/admin/orders");
}

/**
 * Manually fulfil a paid MANUAL-delivery order: record the delivered content
 * (as a Stock row linked to the order), mark the order COMPLETED, and notify
 * the buyer. Only valid for orders awaiting delivery (status PAID).
 */
export async function deliverManualOrderAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!content) return { error: "Isi detail produk yang akan dikirim." };

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Pesanan tidak ditemukan." };
  if (order.status !== "PAID") {
    return { error: "Pesanan ini tidak sedang menunggu pengiriman." };
  }

  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

  // Race-safe: claim the order (PAID -> COMPLETED) first; only deliver if THIS
  // call won, so a double-submit can't create duplicate deliveries.
  const claimed = await prisma.$transaction(async (tx) => {
    const upd = await tx.order.updateMany({
      where: { id: order.id, status: "PAID" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (upd.count === 0) return false;
    await tx.stock.createMany({
      data: lines.map((secret) => ({
        productId: order.productId,
        secret,
        note,
        status: "SOLD" as const,
        orderId: order.id,
      })),
    });
    return true;
  });

  if (!claimed) return { error: "Pesanan ini sudah diproses." };

  try {
    await notifyOrderCompleted(order.id);
  } catch (e) {
    console.error("[notify] manual delivery failed", e);
  }

  // API order: tell the reseller the manual product is now delivered.
  fireResellerCallback(order.id);
  // Referral reward on the buyer's first completed order (idempotent).
  processReferralReward(order.id);

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/manual");
  revalidatePath("/admin");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard");
  return { success: "Produk dikirim ke pembeli." };
}

/* ------------------------------ Users ------------------------------- */

const adminUserSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  role: z.enum(["USER", "ADMIN"]),
});

/** Admin edits a user's data (name, email, phone, role). */
export async function adminUpdateUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "User tidak valid." };

  const parsed = adminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Don't let an admin demote their own account (avoids self-lockout).
  if (id === admin.id && parsed.data.role !== "ADMIN") {
    return { error: "Tidak bisa menurunkan peran akun sendiri." };
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhoneID(phoneRaw);
    if (!phone) return { error: "Nomor WhatsApp tidak valid (contoh: 0812xxxx)." };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        phone,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      if (e.code === "P2002") return { error: "Email sudah dipakai akun lain." };
      if (e.code === "P2025") return { error: "User tidak ditemukan." };
    }
    throw e;
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}/edit`);
  return { success: "Data user berhasil diperbarui." };
}

/**
 * Permanently delete a BUYER account. Cascades their orders, balance ledger,
 * top-ups and withdrawals (delivered stock is detached but kept). Admin accounts
 * (and the acting admin) cannot be deleted — guarded server-side.
 */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === admin.id) return; // never delete self

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target || target.role === "ADMIN") return; // buyers only

  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin/users");
  revalidatePath("/admin"); // stats (revenue/orders/users) change
}
