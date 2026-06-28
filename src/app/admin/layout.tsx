import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/app/actions/auth";
import { buttonStyles } from "@/components/ui";
import AdminNav from "@/components/AdminNav";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");

  // Sidebar "needs attention" counters: withdrawals awaiting review and paid
  // manual orders waiting to be delivered by hand.
  const [pendingWithdrawals, pendingManual] = await Promise.all([
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PAID", product: { fulfillment: "MANUAL" } } }),
  ]);
  const navBadges: Record<string, number> = {
    "/admin/withdrawals": pendingWithdrawals,
    "/admin/manual": pendingManual,
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-ink text-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center border-3 border-paper bg-main text-ink">
              ⚡
            </span>
            <span className="font-display text-lg">
              ADMIN<span className="text-main">PANEL</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className={buttonStyles("white", "sm")}>
              Lihat Toko
            </Link>
            <form action={logoutAction}>
              <button className={buttonStyles("secondary", "sm")}>Keluar</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-6 lg:gap-6">
        <AdminNav badges={navBadges} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
