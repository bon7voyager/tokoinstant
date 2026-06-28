import Link from "next/link";
import { contactInfo } from "@/lib/contact";

export default function Footer() {
  const c = contactInfo();
  return (
    <footer className="mt-20 border-t-3 border-ink bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div>
          <div className="font-display text-2xl">
            KILAT<span className="text-main">.SHOP</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-paper/70">
            Toko produk digital serba otomatis. Bayar, langsung dapat akun.
            Proses 24 jam tanpa nunggu admin.
          </p>
        </div>

        <div>
          <h4 className="font-bold uppercase tracking-wide text-main">Menu</h4>
          <ul className="mt-3 space-y-2 text-sm text-paper/80">
            <li>
              <Link href="/" className="hover:text-main">
                Beranda
              </Link>
            </li>
            <li>
              <Link href="/cara-order" className="hover:text-main">
                Cara Order
              </Link>
            </li>
            <li>
              <Link href="/produk" className="hover:text-main">
                Semua Produk
              </Link>
            </li>
            <li>
              <Link href="/dashboard/orders" className="hover:text-main">
                Pesanan Saya
              </Link>
            </li>
            <li>
              <Link href="/cek-transaksi" className="hover:text-main">
                Cek Transaksi
              </Link>
            </li>
            <li>
              <Link href="/cara-order#faq" className="hover:text-main">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/kontak" className="hover:text-main">
                Hubungi Kami
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold uppercase tracking-wide text-main">Hubungi Kami</h4>
          <ul className="mt-3 space-y-2 text-sm text-paper/80">
            {c.waLink && (
              <li>
                <a href={c.waLink} target="_blank" rel="noopener noreferrer" className="hover:text-main">
                  💬 WhatsApp: {c.waDisplay}
                </a>
              </li>
            )}
            {c.email && (
              <li>
                <a href={`mailto:${c.email}`} className="break-all hover:text-main">
                  ✉️ {c.email}
                </a>
              </li>
            )}
            {c.instagram && (
              <li>
                <a href={c.igLink} target="_blank" rel="noopener noreferrer" className="hover:text-main">
                  📸 @{c.instagram}
                </a>
              </li>
            )}
            {c.telegram && (
              <li>
                <a href={c.tgLink} target="_blank" rel="noopener noreferrer" className="hover:text-main">
                  ✈️ @{c.telegram}
                </a>
              </li>
            )}
            {c.hours && <li className="text-paper/60">🕐 {c.hours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t-3 border-paper/20 py-4 text-center text-xs text-paper/60">
        © {new Date().getFullYear()} Kilat. All Rights Reserved.
      </div>
    </footer>
  );
}
