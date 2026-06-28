/**
 * Generates 20 synthetic "bot" users with random transactions across every
 * log-bearing table (orders, top-ups, withdrawals, membership purchases,
 * admin membership grants/revokes, wallet ledger incl. refunds & adjustments,
 * and a few notifications). Purely for populating the admin logs during dev.
 *
 * Run:  npx tsx prisma/seed-bots.ts
 * Bots use the @kilat.test email domain so they're easy to find/remove later.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const N_USERS = 20;
const DAY = 86_400_000;

const FIRST = [
  "Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi", "Indah", "Joko",
  "Kira", "Lina", "Maya", "Nanda", "Oki", "Putri", "Rama", "Sari", "Tono", "Umar",
  "Vina", "Wawan", "Yani", "Zaki", "Bayu", "Cinta", "Dimas", "Endah",
];
const LAST = [
  "Saputra", "Wijaya", "Pratama", "Lestari", "Nugroho", "Halim", "Santoso",
  "Permata", "Kusuma", "Maulana", "Anggraini", "Firmansyah",
];

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const chance = (p: number) => Math.random() < p;
// A timestamp somewhere in the last `days` days (random time of day).
const recent = (days: number) => new Date(Date.now() - rand(0, days) * DAY - rand(0, DAY));

function invoiceNo(d: Date) {
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const suffix = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rand(0, 31)]).join("");
  return `INV-${ymd}-${suffix}`;
}

const ORDER_STATUSES = [
  "COMPLETED", "COMPLETED", "COMPLETED", "PAID", "PENDING", "FAILED", "EXPIRED", "REFUNDED",
] as const;
const TOPUP_STATUSES = ["PAID", "PAID", "PAID", "PENDING", "FAILED", "EXPIRED"] as const;
const WD_STATUSES = ["APPROVED", "APPROVED", "PENDING", "REJECTED"] as const;
const MP_STATUSES = ["PAID", "PAID", "PENDING", "FAILED", "EXPIRED"] as const;

async function main() {
  console.log("🤖 Seeding bot users + random transactions...");

  const products = await prisma.product.findMany({
    include: { variants: { where: { isActive: true } } },
  });
  if (products.length === 0) {
    throw new Error("No products found — run `npm run db:seed` first so orders have products to attach to.");
  }

  let created = 0;
  for (let i = 0; i < N_USERS; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const tag = rand(1000, 9999);
    const email = `bot.${first}${last}${tag}@kilat.test`.toLowerCase();
    const joinedAt = recent(30);
    const isGuest = chance(0.18);
    const premium = chance(0.35);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: await bcrypt.hash("bot12345", 10),
          role: "USER",
          phone: `628${rand(700000000, 899999999)}`,
          isGuest,
          premiumUntil: premium ? new Date(Date.now() + rand(5, 60) * DAY) : null,
          balance: 0,
          createdAt: joinedAt,
        },
      });
    } catch {
      continue; // rare email clash — skip this one
    }

    // Collect signed ledger events; we sort chronologically and compute the
    // running balanceAfter so the wallet ledger stays monotonic & non-negative.
    const ledger: { type: string; amount: number; note: string; ref: string | null; at: Date }[] = [];

    // ---- Top-ups ----
    for (let t = 0; t < rand(0, 4); t++) {
      const amount = pick([10_000, 20_000, 25_000, 50_000, 100_000, 150_000]);
      const at = recent(28);
      const status = pick([...TOPUP_STATUSES]);
      const tu = await prisma.topUp.create({
        data: {
          userId: user.id,
          amount,
          status,
          paymentRef: status === "PAID" ? `SIM-TOP-${rand(100000, 999999)}` : null,
          createdAt: at,
          paidAt: status === "PAID" ? at : null,
        },
      });
      if (status === "PAID") {
        ledger.push({ type: "TOPUP", amount, note: "Top up saldo", ref: tu.id, at });
      }
    }

    // ---- Orders ----
    for (let o = 0; o < rand(1, 7); o++) {
      const product = pick(products);
      const variant = product.variants.length ? pick(product.variants) : null;
      const unit = variant ? variant.price : product.price;
      const quantity = rand(1, 3);
      const subtotal = unit * quantity;
      const resellerDiscount = premium ? Math.round(subtotal * 0.1) : 0;
      const total = subtotal - resellerDiscount;
      const payMethod = chance(0.5) ? "BALANCE" : "GATEWAY";
      const status = pick([...ORDER_STATUSES]);
      const at = recent(30);
      const paid = status === "PAID" || status === "COMPLETED" || status === "REFUNDED";
      const order = await prisma.order.create({
        data: {
          orderNumber: invoiceNo(at),
          userId: user.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          quantity,
          subtotal,
          resellerDiscount,
          discount: 0,
          total,
          payMethod,
          status,
          paymentRef: payMethod === "GATEWAY" && paid ? `SIM-${rand(100000, 999999)}` : null,
          createdAt: at,
          paidAt: paid ? at : null,
          completedAt: status === "COMPLETED" ? at : null,
        },
      });
      // Wallet effects: balance-paid orders debit the wallet; refunds credit it back.
      if (payMethod === "BALANCE" && paid) {
        ledger.push({ type: "PURCHASE", amount: -total, note: `Beli ${product.name}`, ref: order.orderNumber, at });
      }
      if (status === "REFUNDED") {
        const refundAt = new Date(at.getTime() + rand(1, 5) * 3_600_000);
        ledger.push({ type: "REFUND", amount: total, note: `Refund ${order.orderNumber}`, ref: order.orderNumber, at: refundAt });
      }
    }

    // ---- Withdrawals ----
    for (let w = 0; w < rand(0, 2); w++) {
      const amount = pick([20_000, 30_000, 50_000, 75_000, 100_000]);
      const at = recent(20);
      const status = pick([...WD_STATUSES]);
      const method = chance(0.5) ? "BANK" : "EWALLET";
      const wd = await prisma.withdrawal.create({
        data: {
          userId: user.id,
          amount,
          status,
          method,
          accountName: name,
          accountNumber: method === "BANK" ? `${rand(1000000000, 9999999999)}` : `08${rand(1000000000, 1999999999)}`,
          note: chance(0.3) ? "Tolong diproses cepat ya" : null,
          adminNote: status === "REJECTED" ? "Data rekening tidak cocok" : status === "APPROVED" ? "Sudah ditransfer" : null,
          createdAt: at,
          processedAt: status === "PENDING" ? null : new Date(at.getTime() + rand(1, 24) * 3_600_000),
        },
      });
      // Funds are held (debited) at request time; a rejection returns them.
      ledger.push({ type: "WITHDRAWAL", amount: -amount, note: `Penarikan ${method}`, ref: wd.id, at });
      if (status === "REJECTED") {
        const back = new Date(at.getTime() + rand(2, 24) * 3_600_000);
        ledger.push({ type: "REFUND", amount, note: "Penarikan ditolak: Data rekening tidak cocok", ref: wd.id, at: back });
      }
    }

    // ---- Membership purchases ----
    for (let m = 0; m < rand(0, 2); m++) {
      const amount = pick([25_000, 35_000, 50_000]);
      const at = recent(25);
      const status = pick([...MP_STATUSES]);
      const payMethod = chance(0.5) ? "BALANCE" : "GATEWAY";
      await prisma.membershipPurchase.create({
        data: {
          userId: user.id,
          amount,
          days: 30,
          status,
          payMethod,
          paymentRef: status === "PAID" ? `SIM-MEM-${rand(100000, 999999)}` : null,
          createdAt: at,
          paidAt: status === "PAID" ? at : null,
        },
      });
      if (status === "PAID" && payMethod === "BALANCE") {
        ledger.push({ type: "PURCHASE", amount: -amount, note: "Upgrade Member Premium (Reseller)", ref: "MEM", at });
      }
    }

    // ---- Admin membership actions ----
    if (chance(0.4)) {
      const at = recent(15);
      const grant = chance(0.7);
      await prisma.membershipLog.create({
        data: {
          userId: user.id,
          action: grant ? "GRANT" : "REVOKE",
          days: grant ? 30 : null,
          adminId: "seed-admin",
          note: grant ? "Aktivasi membership oleh admin" : "Membership dicabut oleh admin",
          createdAt: at,
        },
      });
    }

    // ---- Admin balance adjustments ----
    for (let a = 0; a < rand(0, 2); a++) {
      const amount = pick([5_000, 10_000, -5_000, -10_000, 25_000]);
      const at = recent(18);
      ledger.push({
        type: "ADJUSTMENT",
        amount,
        note: amount >= 0 ? "Bonus dari admin" : "Koreksi saldo oleh admin",
        ref: "ADMIN:seed-admin",
        at,
      });
    }

    // ---- Materialize wallet ledger (chronological running balance) ----
    ledger.sort((a, b) => a.at.getTime() - b.at.getTime());
    let balance = 0;
    for (const e of ledger) {
      balance = Math.max(0, balance + e.amount);
      await prisma.balanceTransaction.create({
        data: {
          userId: user.id,
          type: e.type as never,
          amount: e.amount,
          balanceAfter: balance,
          note: e.note,
          ref: e.ref,
          createdAt: e.at,
        },
      });
    }
    await prisma.user.update({ where: { id: user.id }, data: { balance } });

    // ---- A couple of notifications ----
    for (let n = 0; n < rand(0, 2); n++) {
      const at = recent(20);
      const isEmail = chance(0.6);
      const status = pick(["SENT", "SENT", "LOGGED", "FAILED"] as const);
      await prisma.notification.create({
        data: {
          channel: isEmail ? "EMAIL" : "WHATSAPP",
          status,
          template: pick(["order_completed", "topup_success", "membership_active"]),
          to: isEmail ? email : `628${rand(700000000, 899999999)}`,
          subject: isEmail ? "Pesanan kamu sudah diproses" : null,
          body: "Halo! Update transaksi kamu di Kilat.",
          provider: status === "LOGGED" ? null : isEmail ? "resend" : "fonnte",
          error: status === "FAILED" ? "provider timeout" : null,
          userId: user.id,
          createdAt: at,
        },
      });
    }

    created++;
    console.log(`  ✓ ${name} <${email}> — saldo ${balance.toLocaleString("id-ID")} (${ledger.length} mutasi)`);
  }

  const totals = await Promise.all([
    prisma.order.count(),
    prisma.topUp.count(),
    prisma.withdrawal.count(),
    prisma.balanceTransaction.count(),
  ]);
  console.log(`\n🤖 Done. Created ${created} bot users.`);
  console.log(`   DB now has: ${totals[0]} orders, ${totals[1]} top-ups, ${totals[2]} withdrawals, ${totals[3]} ledger entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
