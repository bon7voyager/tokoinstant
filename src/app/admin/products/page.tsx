import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import ProductForm from "@/components/ProductForm";
import ConfirmButton from "@/components/ConfirmButton";
import Pagination from "@/components/Pagination";
import { productVisual } from "@/components/ProductCard";
import {
  toggleProductAction,
  deleteProductAction,
} from "@/app/actions/admin";
import { formatIDR } from "@/lib/utils";
import { premiumConfig } from "@/lib/membership";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;

  const total = await prisma.product.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const [categories, products, stockGroups] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.stock.groupBy({
      by: ["productId"],
      where: { status: "AVAILABLE" },
      _count: { _all: true },
    }),
  ]);

  const baseHref = "/admin/products";

  const stockMap = new Map(stockGroups.map((g) => [g.productId, g._count._all]));

  return (
    <div>
      <h1 className="font-display text-3xl">Produk</h1>
      <p className="font-medium text-ink/60">Kelola produk yang dijual di toko.</p>

      {/* Add product */}
      <details className="group mt-6 border-3 border-ink bg-white shadow-brutal">
        <summary className="flex cursor-pointer items-center justify-between bg-main px-5 py-3 font-bold uppercase tracking-wide">
          + Tambah Produk Baru
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-5">
          <ProductForm
            categories={categories}
            globalResellerPercent={premiumConfig().percent}
          />
        </div>
      </details>

      {/* List */}
      <div className="mt-6 overflow-x-auto border-3 border-ink bg-white shadow-brutal">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b-3 border-ink bg-paper">
            <tr className="font-bold uppercase">
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3">Dilihat</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = stockMap.get(p.id) ?? 0;
              return (
                <tr key={p.id} className="border-b border-ink/10 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border-3 border-ink ${p.imageUrl ? "bg-white" : productVisual(p.name).bg}`}
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-lg">{productVisual(p.name).emoji}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold">
                          {p.name}
                          {p.fulfillment === "MANUAL" && (
                            <Badge variant="grape">Manual</Badge>
                          )}
                        </div>
                        <div className="text-xs text-ink/50">
                          {p.category ? `${p.category.emoji} ${p.category.name}` : "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold">{formatIDR(p.price)}</td>
                  <td className="px-4 py-3">
                    {p.fulfillment === "MANUAL" ? (
                      <span className="text-xs text-ink/40">—</span>
                    ) : (
                      <span className={stock <= 3 ? "font-bold text-secondary" : ""}>
                        {stock}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-medium text-ink/70">
                      👁️ {p.views.toLocaleString("id-ID")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <Badge variant="lime">Aktif</Badge>
                    ) : (
                      <Badge variant="white">Nonaktif</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="border-3 border-ink bg-accent px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm"
                      >
                        Edit
                      </Link>
                      <form action={toggleProductAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="border-3 border-ink bg-white px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                          {p.isActive ? "Sembunyikan" : "Aktifkan"}
                        </button>
                      </form>
                      <form action={deleteProductAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton
                          message={`Hapus "${p.name}"? Jika sudah ada pesanan, produk hanya dinonaktifkan.`}
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

      <Pagination page={page} totalPages={totalPages} baseHref={baseHref} />
    </div>
  );
}
