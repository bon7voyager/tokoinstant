import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { turnstileSiteKey } from "@/lib/turnstile";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lupa Password",
};

export default async function LupaPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const siteKey = turnstileSiteKey();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="border-3 border-ink bg-white p-7 shadow-brutal-lg">
        <h1 className="font-display text-3xl">Lupa Password</h1>
        <p className="mt-1 mb-6 font-medium text-ink/60">
          Masukkan email akunmu — kami kirim kode untuk membuat password baru.
        </p>

        <ForgotPasswordForm turnstileSiteKey={siteKey} />

        <p className="mt-5 text-center text-sm font-medium">
          Ingat passwordmu?{" "}
          <Link href="/login" className="brutal-link">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
