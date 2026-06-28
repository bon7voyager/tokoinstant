import { Badge } from "@/components/ui";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border-3 border-ink bg-ink p-3 text-xs leading-relaxed text-paper">
      <code className="font-mono whitespace-pre">{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  desc,
  children,
}: {
  method: string;
  path: string;
  desc: string;
  children?: React.ReactNode;
}) {
  const tone = method === "POST" ? "lime" : "white";
  return (
    <div className="border-3 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tone as "lime" | "white"}>{method}</Badge>
        <code className="font-mono text-sm font-bold">{path}</code>
      </div>
      <p className="mt-2 text-sm font-medium text-ink/70">{desc}</p>
      {children && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export default function ResellerApiDocs({ baseUrl }: { baseUrl: string }) {
  const B = `${baseUrl}/api/reseller`;

  return (
    <section className="border-3 border-ink bg-white p-5 shadow-brutal sm:p-6">
      <h2 className="font-display text-xl">📖 Dokumentasi API</h2>
      <p className="mt-1 text-sm font-medium text-ink/60">
        Base URL: <code className="font-mono">{B}</code> · Auth:{" "}
        <code className="font-mono">Authorization: Bearer &lt;api_key&gt;</code> · Semua respons JSON
        beramplop <code className="font-mono">{`{ ok, ... }`}</code>.
      </p>

      <div className="mt-4 space-y-4">
        <Endpoint method="GET" path="/products" desc="Daftar produk aktif + harga reseller + stok.">
          <Code>{`curl ${B}/products \\
  -H "Authorization: Bearer rsk_live_xxx"`}</Code>
        </Endpoint>

        <Endpoint
          method="GET"
          path="/products/{slug}"
          desc="Detail satu produk (termasuk varian, jika ada)."
        >
          <Code>{`curl ${B}/products/netflix-premium-1-bulan \\
  -H "Authorization: Bearer rsk_live_xxx"`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/balance" desc="Sisa saldo reseller (untuk bayar order).">
          <Code>{`curl ${B}/balance -H "Authorization: Bearer rsk_live_xxx"
# { "ok": true, "balance": 150000 }`}</Code>
        </Endpoint>

        <Endpoint
          method="POST"
          path="/orders"
          desc="Buat order. Wajib ref_id (id order kamu) untuk idempotency — request ulang dengan ref_id sama mengembalikan order yang sama, bukan order baru."
        >
          <Code>{`curl -X POST ${B}/orders \\
  -H "Authorization: Bearer rsk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "product": "netflix-premium-1-bulan",
    "variant_id": null,
    "quantity": 1,
    "pay_method": "balance",   // "balance" | "gateway"
    "ref_id": "ORDER-12345"
  }'`}</Code>
          <p className="text-sm font-medium text-ink/70">
            <b>balance</b>: langsung dipotong saldo. Produk AUTO → status{" "}
            <code className="font-mono">completed</code> + field{" "}
            <code className="font-mono">account</code> berisi akunnya. Produk MANUAL → status{" "}
            <code className="font-mono">processing</code>, akun menyusul via webhook.
            <br />
            <b>gateway</b>: respons berisi <code className="font-mono">payment</code>{" "}
            (qr/redirect/kode); order <code className="font-mono">pending</code> sampai dibayar, lalu
            webhook dikirim.
          </p>
          <Code>{`// respons (AUTO + balance)
{
  "ok": true,
  "order": {
    "order_ref": "ORDER-12345",
    "order_number": "INV-20260627-AB12CD",
    "status": "completed",
    "total": 20250,
    "account": "akun@mail.com:passw0rd",
    ...
  }
}`}</Code>
        </Endpoint>

        <Endpoint
          method="GET"
          path="/orders"
          desc="Daftar order kamu (terbaru dulu). Query opsional: limit (maks 100, default 20), status, cursor (id order terakhir untuk halaman berikutnya)."
        >
          <Code>{`curl "${B}/orders?limit=20&status=completed" \\
  -H "Authorization: Bearer rsk_live_xxx"
# { "ok": true, "orders": [ ... ], "next_cursor": "<id>" | null }`}</Code>
        </Endpoint>

        <Endpoint
          method="GET"
          path="/orders/{ref}"
          desc="Cek status satu order — pakai ref_id kamu atau order_number kami."
        >
          <Code>{`curl ${B}/orders/ORDER-12345 \\
  -H "Authorization: Bearer rsk_live_xxx"`}</Code>
        </Endpoint>
      </div>

      <h3 className="mt-6 font-display text-lg">🔔 Webhook</h3>
      <p className="mt-1 text-sm font-medium text-ink/60">
        Set URL webhook di atas. Saat order berubah (selesai / akun terkirim / gagal), kami POST JSON
        ke URL itu. Verifikasi keaslian: hitung{" "}
        <code className="font-mono">HMAC_SHA256(signing_secret, raw_body)</code> lalu bandingkan
        dengan header <code className="font-mono">x-kilat-signature</code>.
      </p>
      <Code>{`POST <url-webhook-kamu>
x-kilat-event: order.update
x-kilat-signature: <hmac-sha256-hex>

{
  "event": "order.update",
  "order_ref": "ORDER-12345",
  "order_number": "INV-20260627-AB12CD",
  "status": "completed",
  "product": "Netflix Premium 1 Bulan",
  "total": 20250,
  "account": "akun@mail.com:passw0rd",
  "delivered_at": "2026-06-27T10:00:00.000Z"
}`}</Code>

      <h3 className="mt-6 font-display text-lg">⚠️ Kode Error</h3>
      <p className="mt-1 text-sm font-medium text-ink/60">
        Format: <code className="font-mono">{`{ "ok": false, "error": { "code", "message" } }`}</code>.
        Antara lain: <code className="font-mono">unauthorized</code> (401),{" "}
        <code className="font-mono">membership_inactive</code> (403),{" "}
        <code className="font-mono">product_not_found</code> (404),{" "}
        <code className="font-mono">out_of_stock</code> (409),{" "}
        <code className="font-mono">insufficient_balance</code> (402),{" "}
        <code className="font-mono">rate_limited</code> (429).
      </p>
    </section>
  );
}
