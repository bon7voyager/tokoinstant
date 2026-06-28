import { formatIDR } from "@/lib/utils";
import type { TemplateKey } from "./types";

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
  waText: string;
};

type Credential = { secret: string; note?: string | null };

function emailShell(title: string, bodyHtml: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
  <div style="border:3px solid #111;background:#FFDB58;padding:16px 20px">
    <div style="font-weight:800;font-size:20px">⚡ KILAT.SHOP</div>
  </div>
  <div style="border:3px solid #111;border-top:0;background:#fff;padding:20px">
    <h2 style="margin:0 0 12px">${title}</h2>
    ${bodyHtml}
  </div>
  <p style="text-align:center;color:#999;font-size:12px;margin-top:12px;line-height:1.6">📩 Email ini dikirim otomatis — mohon <b>jangan dibalas</b>.<br/>Butuh bantuan? Hubungi kami lewat <a href="https://kilat.shop/kontak" style="color:#999">kilat.shop/kontak</a>.</p>
</div>`;
}

export function renderTemplate(
  key: TemplateKey,
  d: Record<string, unknown>,
): RenderedTemplate {
  if (key === "order_completed") {
    const name = String(d.name ?? "Pelanggan");
    const productName = String(d.productName ?? "Produk");
    const orderNumber = String(d.orderNumber ?? "-");
    const total = Number(d.total ?? 0);
    const creds = (d.credentials as Credential[] | undefined) ?? [];
    const credLines = creds
      .map((c) => `- ${c.secret}${c.note ? `  (${c.note})` : ""}`)
      .join("\n");

    const text = `Halo ${name}! 🎉
Pesanan kamu *SELESAI* dan akun sudah dikirim.

Invoice : ${orderNumber}
Produk  : ${productName}
Total   : ${formatIDR(total)}

🔓 DETAIL AKUN:
${credLines}

Simpan baik-baik & jangan ganti password tanpa izin agar garansi berlaku.
Terima kasih sudah belanja di Kilat!`;

    const html = emailShell(
      "Pesananmu Selesai 🎉",
      `<p>Halo <b>${name}</b>, akun kamu sudah dikirim otomatis.</p>
       <p><b>Invoice:</b> ${orderNumber}<br/><b>Produk:</b> ${productName}<br/><b>Total:</b> ${formatIDR(total)}</p>
       <p style="font-weight:700">🔓 Detail Akun:</p>
       <pre style="border:3px solid #111;background:#FFFDF5;padding:12px;white-space:pre-wrap;font-size:14px">${creds
         .map((c) => `${c.secret}${c.note ? `  (${c.note})` : ""}`)
         .join("\n")}</pre>
       <p style="color:#666">Jangan ganti password tanpa izin agar garansi tetap berlaku.</p>`,
    );

    return { subject: `✅ Pesanan ${orderNumber} Selesai — Kilat`, html, text, waText: text };
  }

  if (key === "topup_success") {
    const name = String(d.name ?? "Pelanggan");
    const nominal = Number(d.nominal ?? 0);
    const newBalance = Number(d.newBalance ?? 0);
    const ref = d.ref ? String(d.ref) : "";

    const text = `Halo ${name}! Top up kamu *BERHASIL* ✅
Nominal     : ${formatIDR(nominal)}
Saldo baru  : ${formatIDR(newBalance)}${ref ? `\nRef: ${ref}` : ""}`;

    const html = emailShell(
      "Top Up Berhasil ✅",
      `<p>Halo <b>${name}</b>, saldo kamu sudah bertambah.</p>
       <p><b>Nominal:</b> ${formatIDR(nominal)}<br/><b>Saldo baru:</b> ${formatIDR(newBalance)}${
         ref ? `<br/><b>Ref:</b> ${ref}` : ""
       }</p>`,
    );

    return { subject: `✅ Top Up ${formatIDR(nominal)} Berhasil — Kilat`, html, text, waText: text };
  }

  if (key === "membership_active") {
    const name = String(d.name ?? "Pelanggan");
    const until = String(d.until ?? "-");
    const percent = Number(d.percent ?? 0);
    const days = Number(d.days ?? 0);

    const text = `Halo ${name}! 💎 Membership *RESELLER* kamu sekarang AKTIF.
Diskon ${percent}% otomatis di semua produk (${days} hari).
Berlaku sampai: ${until}

Selamat berjualan & hemat terus di Kilat!`;

    const html = emailShell(
      "Membership Reseller Aktif 💎",
      `<p>Halo <b>${name}</b>, membership reseller kamu sudah aktif.</p>
       <p><b>Diskon:</b> ${percent}% di semua produk<br/><b>Durasi:</b> ${days} hari<br/><b>Berlaku sampai:</b> ${until}</p>`,
    );

    return { subject: `💎 Membership Reseller Aktif — Kilat`, html, text, waText: text };
  }

  if (key === "order_paid") {
    const name = String(d.name ?? "Pelanggan");
    const productName = String(d.productName ?? "Produk");
    const orderNumber = String(d.orderNumber ?? "-");
    const total = Number(d.total ?? 0);
    const text = `Halo ${name}! Pembayaran *DITERIMA* ✅
Invoice : ${orderNumber}
Produk  : ${productName}
Total   : ${formatIDR(total)}

Pesanan kamu sedang *DIPROSES* admin (manual). Produk akan dikirim ke halaman pesanan kamu, biasanya maks 1×24 jam. Terima kasih sudah sabar menunggu!`;
    const html = emailShell(
      "Pembayaran Diterima — Sedang Diproses",
      `<p>Halo <b>${name}</b>, pembayaran kamu diterima dan pesanan sedang <b>diproses admin</b>.</p>
       <p><b>Invoice:</b> ${orderNumber}<br/><b>Produk:</b> ${productName}<br/><b>Total:</b> ${formatIDR(total)}</p>
       <p style="color:#666">Produk akan muncul di halaman pesanan kamu (maks 1×24 jam).</p>`,
    );
    return { subject: `✅ Pembayaran ${orderNumber} Diterima — Diproses`, html, text, waText: text };
  }

  if (key === "order_refunded") {
    const name = String(d.name ?? "Pelanggan");
    const orderNumber = String(d.orderNumber ?? "-");
    const total = Number(d.total ?? 0);
    const reason = String(d.reason ?? "-");
    const text = `Halo ${name}, pesanan *${orderNumber}* telah *DIREFUND*.
Nominal ${formatIDR(total)} dikembalikan ke saldo kamu.
Alasan: ${reason}
Saldo bisa dipakai untuk belanja berikutnya. Terima kasih.`;
    const html = emailShell(
      "Pesanan Direfund",
      `<p>Halo <b>${name}</b>, pesanan <b>${orderNumber}</b> telah direfund.</p>
       <p><b>Nominal:</b> ${formatIDR(total)} (dikembalikan ke saldo)<br/><b>Alasan:</b> ${reason}</p>`,
    );
    return { subject: `↩️ Refund ${orderNumber} — Kilat`, html, text, waText: text };
  }

  if (key === "order_warranty") {
    const name = String(d.name ?? "Pelanggan");
    const productName = String(d.productName ?? "Produk");
    const orderNumber = String(d.orderNumber ?? "-");
    const creds = (d.credentials as Credential[] | undefined) ?? [];
    const credLines = creds
      .map((c) => `- ${c.secret}${c.note ? `  (${c.note})` : ""}`)
      .join("\n");
    const text = `Halo ${name}! 🛡️ Garansi pesanan *${orderNumber}* (${productName}) sudah diproses.
Berikut akun PENGGANTI kamu:

${credLines}

Maaf atas kendalanya, dan terima kasih sudah belanja di Kilat!`;
    const html = emailShell(
      "Akun Pengganti (Garansi) 🛡️",
      `<p>Halo <b>${name}</b>, berikut akun pengganti untuk <b>${orderNumber}</b> (${productName}):</p>
       <pre style="border:3px solid #111;background:#FFFDF5;padding:12px;white-space:pre-wrap;font-size:14px">${creds
         .map((c) => `${c.secret}${c.note ? `  (${c.note})` : ""}`)
         .join("\n")}</pre>`,
    );
    return { subject: `🛡️ Akun Pengganti ${orderNumber} — Kilat`, html, text, waText: text };
  }

  if (key === "admin_new_order") {
    const orderNumber = String(d.orderNumber ?? "-");
    const productName = String(d.productName ?? "Produk");
    const total = Number(d.total ?? 0);
    const buyerName = String(d.buyerName ?? "-");
    const buyerEmail = String(d.buyerEmail ?? "-");
    const payMethod = String(d.payMethod ?? "GATEWAY") === "BALANCE" ? "Saldo" : "Bayar Langsung";
    const needsAction = Boolean(d.needsAction);
    const adminUrl = String(d.adminUrl ?? "");
    const actionLine = needsAction
      ? "⚠️ Produk MANUAL — perlu kamu kirim ke pembeli."
      : "✅ Produk otomatis — sudah terkirim ke pembeli.";
    const text = `🛎️ Order baru masuk!
Invoice : ${orderNumber}
Produk  : ${productName}
Total   : ${formatIDR(total)}
Pembeli : ${buyerName} (${buyerEmail})
Metode  : ${payMethod}
${actionLine}${adminUrl ? `\nKelola: ${adminUrl}` : ""}`;
    const html = emailShell(
      "Order Baru Masuk 🛎️",
      `<p style="font-weight:700;font-size:16px">${productName}</p>
       <p><b>Invoice:</b> ${orderNumber}<br/><b>Total:</b> ${formatIDR(total)}<br/><b>Pembeli:</b> ${buyerName} (${buyerEmail})<br/><b>Metode:</b> ${payMethod}</p>
       <p style="font-weight:700">${actionLine}</p>
       ${adminUrl ? `<p><a href="${adminUrl}" style="display:inline-block;border:3px solid #111;background:#FFDB58;padding:8px 16px;font-weight:800;color:#111;text-decoration:none">Buka di Admin</a></p>` : ""}`,
    );
    return { subject: `🛎️ Order Baru ${orderNumber} — Kilat`, html, text, waText: text };
  }

  if (key === "email_verify") {
    const code = String(d.code ?? "------");
    const minutes = Number(d.minutes ?? 10);
    const text = `Kode verifikasi Kilat kamu: ${code}

Masukkan kode ini untuk menyelesaikan pendaftaran.
Berlaku ${minutes} menit. Jangan bagikan kode ini ke siapa pun.`;
    const html = emailShell(
      "Verifikasi Email Kamu",
      `<p>Masukkan kode berikut untuk menyelesaikan pendaftaran:</p>
       <div style="border:3px solid #111;background:#FFFDF5;padding:14px;text-align:center;font-size:30px;font-weight:800;letter-spacing:8px">${code}</div>
       <p style="color:#666">Berlaku ${minutes} menit. Jangan bagikan kode ini ke siapa pun.</p>`,
    );
    return { subject: `${code} — Kode Verifikasi Kilat`, html, text, waText: text };
  }

  if (key === "password_reset") {
    const code = String(d.code ?? "------");
    const minutes = Number(d.minutes ?? 10);
    const text = `Kode reset password Kilat kamu: ${code}

Masukkan kode ini untuk membuat password baru.
Berlaku ${minutes} menit. Jangan bagikan kode ini ke siapa pun.
Kalau kamu tidak meminta reset password, abaikan saja email ini — passwordmu tetap aman.`;
    const html = emailShell(
      "Reset Password Kamu",
      `<p>Ada permintaan reset password untuk akun Kilat kamu. Masukkan kode berikut:</p>
       <div style="border:3px solid #111;background:#FFFDF5;padding:14px;text-align:center;font-size:30px;font-weight:800;letter-spacing:8px">${code}</div>
       <p style="color:#666">Berlaku ${minutes} menit. Jangan bagikan kode ini ke siapa pun.</p>
       <p style="color:#666">Kalau kamu tidak meminta ini, abaikan email ini — passwordmu tetap aman.</p>`,
    );
    return { subject: `${code} — Reset Password Kilat`, html, text, waText: text };
  }

  if (key === "account_created") {
    const name = String(d.name ?? "Pelanggan");
    const email = String(d.email ?? "-");
    const password = String(d.password ?? "-");
    const loginUrl = String(d.loginUrl ?? "/login");
    const text = `Halo ${name}! Akun Kilat kamu sudah dibuat otomatis. 🎉

Login di: ${loginUrl}
Email    : ${email}
Password : ${password}

Simpan baik-baik. Disarankan ganti password di menu Profil setelah login.
Pakai akun ini untuk pesanan berikutnya & lihat riwayat pembelianmu.`;
    const html = emailShell(
      "Akun Kamu Sudah Dibuat 🎉",
      `<p>Halo <b>${name}</b>, akun Kilat kamu dibuat otomatis saat checkout.</p>
       <p><b>Email:</b> ${email}<br/><b>Password:</b> <code style="border:2px solid #111;padding:2px 6px;background:#FFFDF5">${password}</code></p>
       <p><a href="${loginUrl}" style="display:inline-block;border:3px solid #111;background:#FFDB58;padding:8px 16px;font-weight:800;color:#111;text-decoration:none">Login Sekarang</a></p>
       <p style="color:#666">Disarankan ganti password di menu Profil setelah login.</p>`,
    );
    return { subject: `🎉 Akun Kilat Kamu (login & password) `, html, text, waText: text };
  }

  // order_created
  const name = String(d.name ?? "Pelanggan");
  const productName = String(d.productName ?? "Produk");
  const orderNumber = String(d.orderNumber ?? "-");
  const total = Number(d.total ?? 0);

  const text = `Halo ${name}! Pesanan ${orderNumber} sudah dibuat.
Produk: ${productName} — Total: ${formatIDR(total)}
Segera selesaikan pembayaran ya. 🙏`;

  const html = emailShell(
    "Pesanan Dibuat",
    `<p>Halo <b>${name}</b>, pesanan <b>${orderNumber}</b> menunggu pembayaran.</p>
     <p><b>Produk:</b> ${productName}<br/><b>Total:</b> ${formatIDR(total)}</p>`,
  );

  return { subject: `Pesanan ${orderNumber} — Kilat`, html, text, waText: text };
}
