# ⚡ Kilat Shop — Reseller API

API host-to-host (H2H) untuk reseller: jualan produk digital Kilat di website kamu
sendiri, ambil stok/akun otomatis dari sistem kami. Reseller isi saldo dulu, lalu
tiap order memotong saldo dengan **harga reseller**, atau bayar per-order via gateway.

- **Base URL:** `https://your-domain.com/api/reseller` (ganti dengan domain tokomu)
- **Auth:** header `Authorization: Bearer <api_key>`
- **Akses:** hanya **member reseller aktif**. Buat & kelola API key di
  **Dashboard → API Reseller** (`/dashboard/api`).
- **Format respons:** JSON beramplop `{ "ok": true, ... }` atau
  `{ "ok": false, "error": { "code", "message" } }`.

---

## Autentikasi

Setiap request wajib menyertakan API key:

```
Authorization: Bearer rsk_live_xxxxxxxxxxxxxxxxxxxx
```

Kunci dibuat di dashboard dan **hanya ditampilkan sekali**. Simpan rahasia
(jangan taruh di front-end). Bisa punya beberapa key dan dicabut kapan saja.

---

## Endpoint

### `GET /products`

Daftar produk aktif dengan harga reseller + stok.

```bash
curl https://your-domain.com/api/reseller/products \
  -H "Authorization: Bearer rsk_live_xxx"
```

```json
{
  "ok": true,
  "products": [
    {
      "slug": "netflix-premium-1-bulan",
      "name": "Netflix Premium 1 Bulan (Sharing)",
      "description": "...",
      "category": "Streaming Film",
      "fulfillment": "AUTO",
      "price": 20250,
      "list_price": 27000,
      "stock": 12,
      "variants": null
    }
  ]
}
```

- `fulfillment`: `"AUTO"` (akun langsung dari stok) atau `"MANUAL"` (dikirim admin).
- `price`: harga yang **kamu** bayar (sudah diskon reseller). `list_price`: harga normal.
- `stock`: jumlah akun siap kirim (`null` untuk produk MANUAL).
- Produk bervarian: `price/list_price/stock` di level produk `null`; lihat array `variants`.

### `GET /products/{slug}`

Detail satu produk (termasuk `variants` bila ada). Bentuk sama seperti item di atas.

```bash
curl https://your-domain.com/api/reseller/products/netflix-premium-1-bulan \
  -H "Authorization: Bearer rsk_live_xxx"
```

### `GET /balance`

Sisa saldo reseller.

```bash
curl https://your-domain.com/api/reseller/balance \
  -H "Authorization: Bearer rsk_live_xxx"
# { "ok": true, "balance": 150000 }
```

### `POST /orders`

Buat order.

| Field        | Tipe     | Wajib | Keterangan |
|--------------|----------|-------|------------|
| `product`    | string   | ✅    | slug produk |
| `ref_id`     | string   | ✅    | id order **di sistemmu** (idempotency, maks 100 char) |
| `pay_method` | string   | –     | `"balance"` (default) atau `"gateway"` |
| `variant_id` | string   | varian| wajib jika produk punya varian |
| `quantity`   | number   | –     | default `1`, maks `10` |

```bash
curl -X POST https://your-domain.com/api/reseller/orders \
  -H "Authorization: Bearer rsk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "product": "netflix-premium-1-bulan",
    "pay_method": "balance",
    "quantity": 1,
    "ref_id": "ORDER-12345"
  }'
```

**Idempotency:** request ulang dengan `ref_id` yang sama mengembalikan order yang
sama (tidak membuat order/charge baru). Selalu kirim `ref_id` unik per order kamu.

**Alur per `pay_method`:**

- **`balance`** → saldo langsung dipotong.
  - Produk **AUTO** → `status: "completed"` + field `account` berisi kredensial.
  - Produk **MANUAL** → `status: "processing"`; akun menyusul via webhook saat admin kirim.
  - Saldo kurang → error `insufficient_balance` (402), order tidak dibuat.
- **`gateway`** → respons berisi objek `payment` (qris/redirect/kode). Order
  `pending` sampai dibayar; setelah lunas kami kirim **webhook**.

```json
{
  "ok": true,
  "order": {
    "order_ref": "ORDER-12345",
    "order_number": "INV-20260627-AB12CD",
    "status": "completed",
    "pay_method": "BALANCE",
    "product": "Netflix Premium 1 Bulan (Sharing)",
    "quantity": 1,
    "total": 20250,
    "account": "akun@mail.com:passw0rd",
    "created_at": "2026-06-27T10:00:00.000Z"
  }
}
```

Untuk `pay_method: "gateway"` (belum dibayar), `account` masih `null` dan ada:

```json
"payment": {
  "redirect_url": "https://gateway/pay/...",
  "qr_string": "00020101...",
  "qr_image_url": null,
  "pay_code": null
}
```

### `GET /orders`

Daftar order kamu, terbaru dulu. Query opsional:

| Query    | Default | Keterangan |
|----------|---------|------------|
| `limit`  | 20      | maks 100 |
| `status` | –       | filter: `pending`/`processing`/`completed`/`failed`/`expired`/`refunded` |
| `cursor` | –       | id order terakhir dari halaman sebelumnya (keyset pagination) |

```bash
curl "https://your-domain.com/api/reseller/orders?limit=20&status=completed" \
  -H "Authorization: Bearer rsk_live_xxx"
```

```json
{
  "ok": true,
  "orders": [ { "order_ref": "ORDER-12345", "order_number": "INV-...", "status": "completed", "...": "..." } ],
  "next_cursor": "clx... | null"
}
```

Halaman berikutnya: ulangi request dengan `cursor=<next_cursor>` sampai `next_cursor` `null`.

### `GET /orders/{ref}`

Cek status satu order — `{ref}` boleh `ref_id` kamu **atau** `order_number` kami.

```bash
curl https://your-domain.com/api/reseller/orders/ORDER-12345 \
  -H "Authorization: Bearer rsk_live_xxx"
```

Status: `pending` · `processing` · `completed` · `failed` · `expired` · `refunded`.
Field `account` terisi begitu produk terkirim.

---

## 🔔 Webhook (callback)

Set **URL webhook** di Dashboard → API Reseller. Saat order berubah status
(selesai / akun terkirim / gagal), kami `POST` JSON ke URL itu.

```
POST <url-webhook-kamu>
Content-Type: application/json
x-kilat-event: order.update
x-kilat-signature: <hmac-sha256-hex>

{
  "event": "order.update",
  "order_ref": "ORDER-12345",
  "order_number": "INV-20260627-AB12CD",
  "status": "completed",
  "product": "Netflix Premium 1 Bulan (Sharing)",
  "total": 20250,
  "account": "akun@mail.com:passw0rd",
  "delivered_at": "2026-06-27T10:00:00.000Z",
  "created_at": "2026-06-27T09:59:00.000Z"
}
```

**Verifikasi tanda tangan** (wajib, anti pemalsuan):

```js
import { createHmac, timingSafeEqual } from "crypto";

function verify(rawBody, signatureHeader, signingSecret) {
  const expected = createHmac("sha256", signingSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

`signing_secret` ada di Dashboard → API Reseller. Balas `2xx` untuk acknowledge;
kami retry beberapa kali jika gagal. **Status tiap pengiriman** (terkirim/gagal +
kode HTTP) bisa kamu pantau di **Dashboard → API Reseller → Riwayat Webhook**.

---

## ⚠️ Kode error

| HTTP | `code`                 | Arti |
|------|------------------------|------|
| 400  | `invalid_json`, `product_required`, `ref_id_required`, `invalid_pay_method`, `variant_required` | request tidak valid |
| 401  | `unauthorized`         | API key salah / tidak ada |
| 402  | `insufficient_balance` | saldo kurang |
| 403  | `membership_inactive`  | membership reseller tidak aktif |
| 404  | `product_not_found`, `order_not_found` | tidak ditemukan |
| 409  | `out_of_stock`         | stok habis |
| 429  | `rate_limited`         | terlalu banyak request |
| 5xx  | `gateway_error`, `settle_failed`, `internal` | gangguan server/gateway |

---

## Catatan

- **Harga**: yang dipakai adalah harga reseller (diskon global / per-produk).
- **Idempotency** memakai pasangan (reseller, `ref_id`) — aman untuk retry.
- **Rate limit**: ~120 request/menit (order ~60/menit) per reseller.
- Spec mesin (OpenAPI): `/openapi.yaml`.
