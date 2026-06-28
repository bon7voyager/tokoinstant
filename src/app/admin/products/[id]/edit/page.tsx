import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/ProductForm";
import { premiumConfig } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="brutal-link text-sm">
        ← Kembali ke produk
      </Link>
      <h1 className="mt-4 font-display text-3xl">Edit Produk</h1>

      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <ProductForm
          categories={categories}
          product={product}
          globalResellerPercent={premiumConfig().percent}
        />
      </div>
    </div>
  );
}
