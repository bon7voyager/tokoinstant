import { Suspense } from "react";
import TrackForm from "@/components/TrackForm";
import RealtimeTransactions from "@/components/RealtimeTransactions";
import { getRecentTransactions } from "@/lib/transactions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cek Transaksi — Kilat",
  description: "Cek detail pembelian pakai nomor invoice & lihat transaksi real-time.",
};

export default async function CekTransaksiPage() {
  const txns = await getRecentTransactions();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Invoice lookup */}
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl sm:text-4xl">Cek Invoice Kamu dengan Mudah & Cepat</h1>
        <p className="mt-2 font-medium text-ink/60">
          Lihat detail pembelianmu menggunakan nomor invoice — tanpa perlu login.
        </p>
      </div>
      <div
        id="cari"
        className="mx-auto mt-6 max-w-xl scroll-mt-24 border-3 border-ink bg-white p-6 shadow-brutal-lg"
      >
        <Suspense fallback={null}>
          <TrackForm />
        </Suspense>
      </div>

      {/* Real-time transactions feed */}
      <div className="mt-14">
        <div className="text-center">
          <h2 className="font-display text-2xl sm:text-3xl">Transaksi Real-Time</h2>
          <p className="mt-1 font-medium text-ink/60">
            Data pesanan masuk terbaru di Kilat.
          </p>
        </div>
        <div className="mt-6">
          <RealtimeTransactions initial={txns} />
        </div>
      </div>
    </div>
  );
}
