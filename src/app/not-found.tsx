import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <div className="border-3 border-ink bg-bubble p-10 shadow-brutal-lg">
        <div className="font-display text-7xl">404</div>
        <p className="mt-3 max-w-sm font-bold">
          Halaman tidak ditemukan. Mungkin produknya sudah habis atau pindah.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonStyles("ink", "lg")}>
            Ke Beranda
          </Link>
          <Link href="/produk" className={buttonStyles("white", "lg")}>
            Lihat Produk
          </Link>
        </div>
      </div>
    </div>
  );
}
