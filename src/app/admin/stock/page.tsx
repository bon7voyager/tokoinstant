import { prisma } from "@/lib/prisma";
import { Badge, Select } from "@/components/ui";
import AddStockForm from "@/components/AddStockForm";
import ConfirmButton from "@/components/ConfirmButton";
import Pagination from "@/components/Pagination";
import { deleteStockAction, assignStockToVariantAction } from "@/app/actions/admin";
import { formatDate, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;

  const total = await prisma.product.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), totalPages);

  const [formProducts, products] = await Promise.all([
    // Full product list (lightweight) for the "Tambah Stok" dropdown.
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    // Paginated list with stock details for the accordion below.
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
        stocks: {
          orderBy: { createdAt: "desc" },
          include: { variant: { select: { name: true } } },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl">Stok</h1>
      <p className="font-medium text-ink/60">
        Isi stok akun/voucher. Saat ada yang beli, stok paling lama dikirim otomatis.
      </p>

      {/* Add stock */}
      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <h2 className="mb-4 font-display text-xl">Tambah Stok</h2>
        {formProducts.length === 0 ? (
          <p className="font-medium text-ink/60">
            Tambahkan produk dulu sebelum mengisi stok.
          </p>
        ) : (
          <AddStockForm
            products={formProducts.map((p) => ({ id: p.id, name: p.name, variants: p.variants }))}
          />
        )}
      </div>

      {/* Stock per product */}
      <div className="mt-8 space-y-4">
        {products.map((p) => {
          const available = p.stocks.filter((s) => s.status === "AVAILABLE").length;
          const sold = p.stocks.length - available;
          // Per-variant available counts, for products that use variants.
          const availByVariant = new Map<string, number>();
          let nullPoolAvail = 0; // product-level stock (no variant) — leftover from before variants
          for (const s of p.stocks) {
            if (s.status !== "AVAILABLE") continue;
            if (s.variantId) {
              availByVariant.set(s.variantId, (availByVariant.get(s.variantId) ?? 0) + 1);
            } else {
              nullPoolAvail++;
            }
          }
          // Stock stranded on a now-deactivated variant (rare): everything available
          // that isn't on an active variant and isn't product-level.
          const activeVariantAvail = p.variants.reduce(
            (sum, v) => sum + (availByVariant.get(v.id) ?? 0),
            0,
          );
          const inactiveStranded = available - activeVariantAvail - nullPoolAvail;
          return (
            <details key={p.id} className="group border-3 border-ink bg-white shadow-brutal">
              <summary className="cursor-pointer px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{p.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={available <= 3 ? "secondary" : "lime"}>
                      {available} tersedia
                    </Badge>
                    <Badge variant="white">{sold} terjual</Badge>
                    <span className="transition-transform group-open:rotate-180">▾</span>
                  </span>
                </div>
                {/* Per-variant stock breakdown (only when the product has variants). */}
                {p.variants.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.variants.map((v) => {
                      const n = availByVariant.get(v.id) ?? 0;
                      return (
                        <span
                          key={v.id}
                          className={cn(
                            "border-2 border-ink px-2 py-0.5 text-xs font-bold",
                            n === 0 ? "bg-secondary text-white" : n <= 3 ? "bg-main" : "bg-lime",
                          )}
                        >
                          {v.name}: {n === 0 ? "habis" : n}
                        </span>
                      );
                    })}
                    {nullPoolAvail > 0 && (
                      <span
                        title="Stok lama tanpa varian — tidak bisa dibeli. Pindahkan ke varian (lihat detail) atau hapus."
                        className="border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold text-ink/60"
                      >
                        ⚠ Tanpa varian: {nullPoolAvail}
                      </span>
                    )}
                    {inactiveStranded > 0 && (
                      <span
                        title="Stok pada varian yang sudah dinonaktifkan — tidak bisa dibeli. Aktifkan kembali variannya atau hapus stoknya."
                        className="border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold text-ink/60"
                      >
                        ⚠ Varian nonaktif: {inactiveStranded}
                      </span>
                    )}
                  </div>
                )}
              </summary>

              <div className="border-t-3 border-ink p-4">
                {/* Rescue leftover product-level stock by moving it into a variant. */}
                {nullPoolAvail > 0 && p.variants.length > 0 && (
                  <form
                    action={assignStockToVariantAction}
                    className="mb-4 flex flex-wrap items-center gap-2 border-3 border-ink bg-paper p-3"
                  >
                    <input type="hidden" name="productId" value={p.id} />
                    <span className="text-sm font-bold">
                      ⚠ {nullPoolAvail} stok tanpa varian — pindahkan ke:
                    </span>
                    <Select name="variantId" required className="!w-auto !py-1.5 !text-xs">
                      {p.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                    <button className="shrink-0 border-3 border-ink bg-main px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                      Pindahkan
                    </button>
                  </form>
                )}
                {p.stocks.length === 0 ? (
                  <p className="py-3 text-center text-sm font-medium text-ink/50">
                    Belum ada stok.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {p.stocks.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 border-3 border-ink bg-paper px-3 py-2"
                      >
                        <div className="min-w-0">
                          <code className="block truncate font-mono text-sm font-bold">
                            {s.secret}
                          </code>
                          <span className="text-xs text-ink/50">
                            {s.variant ? (
                              <>
                                <b className="text-ink/70">{s.variant.name}</b> ·{" "}
                              </>
                            ) : null}
                            {formatDate(s.createdAt)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {s.status === "AVAILABLE" ? (
                            <>
                              <Badge variant="lime">Ready</Badge>
                              <form action={deleteStockAction}>
                                <input type="hidden" name="id" value={s.id} />
                                <ConfirmButton
                                  message="Hapus stok ini?"
                                  className="bg-secondary text-white"
                                >
                                  Hapus
                                </ConfirmButton>
                              </form>
                            </>
                          ) : (
                            <Badge variant="white">Terjual</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} baseHref="/admin/stock" />
    </div>
  );
}
