import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google-oauth";
import { turnstileSiteKey } from "@/lib/turnstile";
import RegisterForm from "@/components/RegisterForm";
import GoogleButton from "@/components/GoogleButton";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const showGoogle = googleConfigured();
  const siteKey = turnstileSiteKey();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="border-3 border-ink bg-white p-7 shadow-brutal-lg">
        <h1 className="font-display text-3xl">Daftar</h1>
        <p className="mt-1 mb-6 font-medium text-ink/60">
          Buat akun gratis dan mulai belanja produk digital.
        </p>

        {showGoogle && (
          <>
            <GoogleButton label="Daftar dengan Google" />
            <div className="my-5 flex items-center gap-3 text-sm font-bold uppercase text-ink/40">
              <span className="h-0.5 flex-1 bg-ink/15" />
              atau
              <span className="h-0.5 flex-1 bg-ink/15" />
            </div>
          </>
        )}

        <RegisterForm turnstileSiteKey={siteKey} />
        <p className="mt-5 text-center text-sm font-medium">
          Sudah punya akun?{" "}
          <Link href="/login" className="brutal-link">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
