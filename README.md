# ⚡ Kilat Shop

Toko **produk digital serba otomatis** (Netflix, YouTube Premium, Spotify, ChatGPT, Canva, dll) dengan tema **neobrutalism**. Pembeli bayar → akun langsung dikirim otomatis dari stok. Lengkap dengan **login user**, **dashboard admin**, **saldo/top up**, **kupon diskon**, **notifikasi Email + WhatsApp**, dan **payment gateway** (Midtrans/Tripay) yang siap pakai.

![tema](https://img.shields.io/badge/tema-neobrutalism-FFDB58?style=flat-square) ![stack](https://img.shields.io/badge/Next.js-15-black?style=flat-square) ![db](https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square)

---

## ✨ Fitur

- 🛍️ **Storefront** — katalog 16 produk, filter kategori, halaman detail, halaman **Cara Order + FAQ**
- 🔐 **Auth** — register & login user + role admin (JWT httpOnly cookie + bcrypt), plus opsional **Login dengan Google** (OAuth2)
- ⚡ **Checkout serba otomatis** — bayar → lunas → **stok akun dikirim otomatis** ke dashboard
- 🧑‍💼 **Produk kirim manual** — selain auto, produk bisa diset "manual" (joki/top-up/jasa): bayar → status Diproses → admin kirim sendiri → Selesai. Plus **batas waktu bayar** (order belum dibayar otomatis batal)
- 👛 **Saldo / Top Up / Tarik Saldo** — dompet dengan buku besar (ledger) anti double-spend; top up (2 langkah), bayar pakai saldo, dan **tarik saldo** (user ajukan → saldo ditahan → admin setujui/tolak)
- 🎟️ **Kupon diskon** — persen/nominal, min. belanja, kuota, kedaluwarsa; validasi anti bocor kuota
- 💳 **Payment gateway** — abstraksi provider: **simulation** (default), **Midtrans** (Snap), **Tripay** (QRIS) + webhook bertanda tangan
- 🔔 **Notifikasi** — Email (Resend/SMTP) + WhatsApp (Fonnte) saat pesanan selesai & top up; jika tanpa API key, otomatis hanya dicatat (LOG)
- 📊 **Dashboard user** — pesanan, akun terkirim, saldo + riwayat, profil
- 🖼️ **Foto produk** — admin bisa unggah foto (maks 4MB, tersimpan di `/public/uploads`) atau tempel URL gambar; tampil dalam bingkai neobrutalism, fallback ke ikon emoji bila kosong
- 🧑‍💼 **Dashboard admin** — omzet, produk (CRUD + foto), stok (bulk), pesanan, **kupon**, **saldo user**, **log notifikasi**, pengguna
- 🎨 **Neobrutalism** — border tebal, shadow keras, warna ngejreng, marquee, animasi statistik

---

## 🧰 Tech Stack

| Bagian      | Teknologi                                  |
| ----------- | ------------------------------------------ |
| Framework   | Next.js 15 (App Router) + React 19         |
| Bahasa      | TypeScript                                 |
| Database    | Prisma + SQLite (mudah pindah ke Postgres) |
| Auth        | `jose` (JWT) + `bcryptjs`                   |
| Styling     | Tailwind CSS                               |
| Validasi    | Zod                                        |
| Mutasi      | Next.js Server Actions (webhook via Route Handler) |

---

## 🚀 Cara Menjalankan

```bash
npm install
npm run db:push      # buat tabel
npm run db:seed      # isi admin, user, 16 produk + stok, 3 kupon demo
npm run dev          # http://localhost:3000
```

### 🔑 Akun & Kupon Demo

| Peran | Email                 | Password   |
| ----- | --------------------- | ---------- |
| Admin | `admin@kilat.shop` | `admin123` |
| User  | `user@kilat.shop`  | `user123`  |

Kupon demo: **HEMAT10** (10%, maks 15rb) · **POTONG5K** (−5rb, min 20rb) · **NEWUSER** (20%, min 25rb)

> Reset DB ke kondisi awal kapan saja: `npm run db:reset`

---

## 🔄 Alur Serba Otomatis

1. Admin isi **stok** di `/admin/stock` — 1 baris = 1 akun (`email:password` atau kode).
2. Pembeli **checkout** (bisa pakai **kupon** & pilih **bayar pakai saldo**) → pesanan `PENDING`.
3. Pembeli **bayar**. Saat lunas, di satu transaksi atomik sistem:
   - menaikkan pemakaian kupon (anti bocor kuota),
   - memotong saldo (kalau bayar pakai saldo, anti double-spend),
   - mengambil stok `AVAILABLE` tertua & menandainya `SOLD`,
   - mengubah pesanan jadi `COMPLETED`,
   - lalu mengirim **notifikasi** (email + WA bila ada nomor).
4. Akun muncul di **dashboard pembeli** untuk disalin.

Logika inti ada di [`src/lib/order-settle.ts`](src/lib/order-settle.ts) (`settleOrderTransaction`, modul `server-only` agar tak bisa dipanggil langsung sebagai server action), dipakai ulang oleh server action **dan** webhook gateway.

---

## 💳 Payment Gateway

Default `PAYMENT_PROVIDER=simulation` → tombol bayar langsung dianggap lunas (akun terkirim). Untuk live, set provider + isi key di `.env`:

- **Midtrans (Snap):** `MIDTRANS_SERVER_KEY`, dst. Webhook: `<APP_BASE_URL>/api/webhook/midtrans` (verifikasi SHA512 `signature_key`).
- **Tripay (QRIS/VA):** `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, `TRIPAY_MERCHANT_CODE`. Webhook: `<APP_BASE_URL>/api/webhook/tripay` (verifikasi HMAC-SHA256 `X-Callback-Signature`).

Webhook **idempotent** (callback ganda aman), **tahan tampering** (percaya nominal tersimpan, bukan dari gateway), dan kalau dana masuk tapi stok habis → pesanan ditandai `FAILED` untuk refund manual. Provider akan otomatis fallback ke `simulation` bila key belum diisi. Top up saldo memakai jalur pembayaran yang sama.

---

## 🔓 Login dengan Google (opsional)

Tombol "Masuk dengan Google" muncul otomatis di halaman login & daftar **jika** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` diisi (kalau kosong, tombol disembunyikan — app tetap jalan). Setup:

1. Buat OAuth credentials di [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Tambahkan **Authorized redirect URI**: `<APP_BASE_URL>/api/auth/google/callback` (mis. `http://localhost:3000/api/auth/google/callback`).
3. Isi `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` di `.env`, set `APP_BASE_URL` sesuai domain/port.

Alur: OAuth2 dengan proteksi **state/CSRF**, hanya menerima email **terverifikasi**, dan otomatis **menautkan ke akun yang emailnya sama** atau membuat akun baru (tanpa password). Sesi pakai JWT yang sama dengan login biasa.

## 🔔 Notifikasi (Email + WhatsApp)

Tanpa konfigurasi, setiap event hanya dicatat (`LOGGED`) — bisa dilihat di `/admin/notifications`. Aktifkan dengan mengisi key:

- **Email:** Resend (`RESEND_API_KEY` + `RESEND_FROM`) atau SMTP (`SMTP_*`, butuh `npm i nodemailer`).
- **WhatsApp:** Fonnte (`FONNTE_TOKEN`). User mengisi nomor WA di profil/registrasi.

Notifikasi bersifat *fire-and-forget* — gagal kirim tidak pernah membatalkan transaksi. Set `NOTIFY_LOG_BODY=redacted` untuk menyamarkan kredensial di log.

---

## 🌍 Deploy ke Produksi

- **Wajib** ganti `AUTH_SECRET`. Set `APP_BASE_URL`/`NEXT_PUBLIC_SITE_URL` ke domain asli.
- **Database**: untuk produksi pakai Postgres — ubah `provider` di `prisma/schema.prisma` ke `postgresql`, set `DATABASE_URL`, lalu `npx prisma migrate deploy`.
- Daftarkan URL webhook gateway di dashboard Midtrans/Tripay.
- Build: `npm run build && npm start`.

---

## 📁 Struktur Proyek

```
src/
├─ app/
│  ├─ (shop)/              # publik + user (navbar/footer)
│  │  ├─ page.tsx          # beranda: hero, marquee, stats, testi, katalog
│  │  ├─ cara-order/       # panduan + FAQ
│  │  ├─ products/[slug]/  # detail + beli (kupon + saldo)
│  │  ├─ login, register/
│  │  └─ dashboard/        # pesanan, detail akun, topup, profil
│  ├─ admin/               # ringkasan, produk, stok, pesanan, kupon, saldo, notifikasi, pengguna
│  ├─ api/webhook/         # midtrans + tripay route handlers
│  └─ actions/             # server actions: auth, orders, payments, wallet, coupons, profile, notifications, admin
├─ lib/
│  ├─ payment/             # abstraksi provider + simulation/midtrans/tripay + webhook handler
│  ├─ notify/              # config, providers (resend/smtp/fonnte), templates, phone, redact
│  ├─ coupons.ts, wallet.ts, auth.ts, prisma.ts, utils.ts
└─ components/             # UI kit neobrutalism + form + kartu
prisma/ schema.prisma · seed.ts
```

---

## 🔒 Keamanan

- Password bcrypt; sesi JWT di cookie **httpOnly**. `/admin` dijaga role, `/dashboard` butuh login.
- Saldo: ledger sumber kebenaran + cache `User.balance`; debit pakai `updateMany WHERE balance >= amount` (anti double-spend).
- Kupon: `usedCount` dinaikkan atomik hanya saat lunas (anti bocor kuota).
- Webhook bertanda tangan + timing-safe compare. **Ganti `AUTH_SECRET` sebelum produksi.**

---

Dibuat dengan ⚡ dan tema neobrutalism.
