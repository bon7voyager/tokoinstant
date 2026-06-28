import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import FlashSaleForm from "@/components/FlashSaleForm";
import ConfirmButton from "@/components/ConfirmButton";
import {
  toggleFlashSaleAction,
  deleteFlashSaleAction,
} from "@/app/actions/flash-sale";

export const dynamic = "force-dynamic";

type SaleStatus = { label: string; tone: "lime" | "main" | "white" };

export default async function AdminFlashSalePage() {
  const now = new Date();
  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
    prisma.flashSale.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const statusOf = (s: (typeof sales)[number]): SaleStatus => {
    if (!s.isActive) return { label: "Nonaktif", tone: "white" };
    if (now < s.startsAt) return { label: "Terjadwal", tone: "main" };
    if (now >= s.endsAt) return { label: "Selesai", tone: "white" };
    return { label: "Aktif", tone: "lime" };
  };

  return (
    <div>
      <h1 className="font-display text-3xl">⚡ Flash Sale</h1>
      <p className="font-medium text-ink/60">
        Diskon waktu-terbatas untuk produk pilihan. Pembeli bayar harga termurah
        (flash vs reseller). Countdown tampil otomatis di toko.
      </p>

      <details className="group mt-6 border-3 border-ink bg-white shadow-brutal">
        <summary className="flex cursor-pointer items-center justify-between bg-main px-5 py-3 font-bold uppercase tracking-wide">
          + Buat Flash Sale Baru
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-5">
          {products.length === 0 ? (
            <p className="text-sm font-medium text-ink/50">Belum ada produk aktif.</p>
          ) : (
            <FlashSaleForm products={products} />
          )}
        </div>
      </details>

      <div className="mt-6 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Periode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-medium text-ink/50">
                  Belum ada flash sale.
                </td>
              </tr>
            )}
            {sales.map((s) => {
              const st = statusOf(s);
              return (
                <tr key={s.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3">{s._count.items} produk</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/60">
                    {formatDate(s.startsAt)} → {formatDate(s.endsAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <form action={toggleFlashSaleAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="border-3 border-ink bg-white px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                          {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                      <form action={deleteFlashSaleAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmButton
                          message={`Hapus flash sale "${s.name}"?`}
                          className="bg-secondary text-white"
                        >
                          Hapus
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
