import Link from "next/link";
import type { Metadata } from "next";
import { buttonStyles } from "@/components/ui";
import { Faq, type QA } from "@/components/Faq";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cara Order",
  description:
    "Panduan order produk digital di Kilat: pilih produk, login, bayar, dan akun otomatis terkirim. Plus FAQ garansi, refund, pembayaran, dan kupon.",
};

const STEPS = [
  {
    n: 1,
    title: "Pilih Produk",
    desc: "Buka halaman Katalog, pilih produk yang kamu mau (Netflix, Spotify, Canva Pro, dan lainnya). Cek harga, deskripsi, dan sisa stok sebelum checkout.",
    bg: "bg-main",
  },
  {
    n: 2,
    title: "Daftar / Login",
    desc: "Belum punya akun? Daftar gratis cuma butuh email & nama. Sudah punya? Tinggal masuk. Akun kamu dipakai untuk menyimpan riwayat pesanan dan menerima produk.",
    bg: "bg-accent",
  },
  {
    n: 3,
    title: "Bayar Pesanan",
    desc: 'Klik "Beli", lalu lanjut ke pembayaran (bisa juga pakai Saldo). Pembayaran terverifikasi otomatis 24 jam. Begitu lunas, status pesanan langsung jadi "Selesai".',
    bg: "bg-lime",
  },
  {
    n: 4,
    title: "Akun Otomatis Terkirim",
    desc: 'Detail akun (email & password atau kode voucher) langsung muncul di halaman pesanan kamu. Klik "Salin" untuk menyalin, lalu langsung login ke layanannya. Selesai!',
    bg: "bg-bubble",
  },
];

const FAQ: QA[] = [
  {
    q: "Apakah semua akun bergaransi?",
    a: "Ya. Semua produk bergaransi penuh selama masa aktif paket. Kalau ada kendala login atau akun bermasalah di tengah masa aktif, kamu bisa klaim garansi dan kami ganti tanpa biaya tambahan.",
  },
  {
    q: "Berapa lama proses pengiriman akun?",
    a: "Otomatis dan instan. Begitu pembayaran terverifikasi, detail akun langsung muncul di halaman pesanan kamu di dashboard. Tidak perlu menunggu admin online — proses berjalan 24 jam.",
  },
  {
    q: "Apakah akun sharing ini legal dan aman?",
    a: "Produk yang kami jual adalah akun sharing/member-family resmi yang dibeli secara legal. Selama dipakai wajar dan sesuai aturan (tidak ganti email/password sendiri, tidak dibagikan ke banyak orang), akun aman digunakan.",
  },
  {
    q: "Apa boleh ganti password atau email akunnya?",
    a: "Tidak. Untuk akun sharing, mengganti email atau password bisa membuat akun terkunci dan garansi otomatis hangus. Cukup gunakan kredensial yang kami kirim apa adanya.",
  },
  {
    q: "Bagaimana kebijakan refund?",
    a: "Refund berlaku jika stok habis setelah kamu bayar (sangat jarang karena stok otomatis) atau jika akun tidak bisa dipakai sama sekali dan tidak bisa kami ganti. Karena produk digital, refund tidak berlaku untuk akun yang sudah aktif dan berfungsi normal.",
  },
  {
    q: "Berapa lama durasi/masa aktif tiap produk?",
    a: "Tertera jelas di nama produk, misalnya '1 Bulan' atau '1 Tahun'. Masa aktif dihitung sejak akun pertama kali kamu pakai login.",
  },
  {
    q: "Metode pembayaran apa saja yang diterima?",
    a: "Kami mendukung pembayaran digital populer di Indonesia seperti QRIS, e-wallet (GoPay, OVO, DANA, ShopeePay), dan transfer bank. Semua pembayaran terverifikasi otomatis.",
  },
  {
    q: "Apa itu fitur saldo dan bagaimana cara pakainya?",
    a: "Saldo adalah dompet di akun Kilat yang bisa kamu top up lebih dulu, lalu dipakai untuk checkout sekali klik tanpa bayar ulang tiap transaksi. Cocok buat kamu yang sering order.",
  },
  {
    q: "Apakah ada kupon atau potongan harga?",
    a: "Ada. Dari waktu ke waktu kami membagikan kode kupon untuk diskon. Masukkan kodenya saat checkout untuk memotong total harga. Pantau terus halaman ini dan media sosial kami.",
  },
  {
    q: "Akun bisa dipakai di berapa perangkat?",
    a: "Tergantung produknya — umumnya 1 profil/1 perangkat aktif untuk akun sharing. Detailnya tertulis di deskripsi tiap produk. Jangan login di banyak perangkat sekaligus agar akun tidak terkunci.",
  },
  {
    q: "Bagaimana cara klaim garansi kalau akun bermasalah?",
    a: "Buka pesanan terkait di dashboard, lalu hubungi CS kami dengan menyertakan nomor pesanan (INV-xxxx). Tim kami akan cek dan mengganti akun secepatnya selama masih dalam masa aktif.",
  },
];

export default async function CaraOrderPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="text-center">
        <span className="inline-block border-3 border-ink bg-white px-3 py-1 text-sm font-bold uppercase shadow-brutal-sm">
          📖 Panduan Lengkap
        </span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">Cara Order di Kilat</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-ink/80">
          Belanja produk digital itu gampang. Ikuti 4 langkah di bawah ini, dan akun
          kamu langsung dikirim otomatis ke dashboard — tanpa nunggu admin online.
        </p>
      </div>

      {/* Steps */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className={`border-3 border-ink ${s.bg} p-6 shadow-brutal`}>
            <span className="flex h-12 w-12 items-center justify-center border-3 border-ink bg-ink font-display text-2xl text-paper shadow-brutal-sm">
              {s.n}
            </span>
            <h3 className="mt-4 font-display text-xl">{s.title}</h3>
            <p className="mt-2 text-sm font-medium text-ink/80">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 border-3 border-ink bg-secondary p-6 text-white shadow-brutal sm:flex-row">
        <p className="font-display text-xl">Siap belanja? Yuk pilih produknya sekarang.</p>
        <div className="flex shrink-0 gap-3">
          <Link href="/produk" className={buttonStyles("main", "md")}>
            Lihat Katalog →
          </Link>
          {!user && (
            <Link href="/register" className={buttonStyles("white", "md")}>
              Daftar Gratis
            </Link>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="mt-14 scroll-mt-24">
        <h2 className="mb-6 font-display text-3xl">Pertanyaan Umum (FAQ)</h2>
        <Faq items={FAQ} />
      </div>
    </div>
  );
}
