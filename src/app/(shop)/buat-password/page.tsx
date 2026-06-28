import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { turnstileSiteKey } from "@/lib/turnstile";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

/** Welcome step shown right after a Google sign-up: invites the user to set a
 * password so they can also log in manually. Optional — they can skip it. */
export default async function BuatPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/buat-password");

  // Already has a password (manual/guest/reclaimed account) → nothing to do here.
  const acct = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (acct?.password) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="border-3 border-ink bg-white p-6 shadow-brutal sm:p-7">
        <div className="text-4xl">🎉</div>
        <h1 className="mt-2 font-display text-2xl">Selamat datang, {user.name}!</h1>
        <p className="mt-2 font-medium text-ink/70">
          Akunmu berhasil dibuat lewat Google. Buat password sekarang biar kamu juga
          bisa <b>login manual</b> (email + password), bukan cuma lewat Google.
        </p>

        <div className="mt-5">
          <ChangePasswordForm
            hasPassword={false}
            turnstileSiteKey={turnstileSiteKey()}
            redirectOnSuccess="/dashboard"
          />
        </div>

        <div className="mt-4 border-t-3 border-ink/10 pt-4 text-center">
          <Link href="/dashboard" className="brutal-link text-sm">
            Lewati dulu, atur nanti →
          </Link>
        </div>
      </div>
    </div>
  );
}
