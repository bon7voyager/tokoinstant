import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CouponForm from "@/components/CouponForm";

export const dynamic = "force-dynamic";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  return (
    <div>
      <Link href="/admin/coupons" className="brutal-link text-sm">
        ← Kembali ke kupon
      </Link>
      <h1 className="mt-4 font-display text-3xl">Edit Kupon</h1>
      <div className="mt-6 border-3 border-ink bg-white p-6 shadow-brutal">
        <CouponForm coupon={coupon} />
      </div>
    </div>
  );
}
