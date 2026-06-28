import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google-oauth";
import { turnstileSiteKey } from "@/lib/turnstile";
import { Alert } from "@/components/ui";
import LoginForm from "@/components/LoginForm";
import GoogleButton from "@/components/GoogleButton";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  google: "Gagal masuk dengan Google. Coba lagi.",
  google_off: "Login Google belum diaktifkan.",
  google_unverified: "Email Google kamu belum terverifikasi.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const { next, error } = await searchParams;
  const showGoogle = googleConfigured();

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="border-3 border-ink bg-white p-7 shadow-brutal-lg">
        <h1 className="font-display text-3xl">Masuk</h1>
        <p className="mt-1 mb-6 font-medium text-ink/60">
          Selamat datang kembali di Kilat.
        </p>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{ERRORS[error] ?? "Terjadi kesalahan."}</Alert>
          </div>
        )}

        {showGoogle && (
          <>
            <GoogleButton label="Masuk dengan Google" />
            <div className="my-5 flex items-center gap-3 text-sm font-bold uppercase text-ink/40">
              <span className="h-0.5 flex-1 bg-ink/15" />
              atau
              <span className="h-0.5 flex-1 bg-ink/15" />
            </div>
          </>
        )}

        <LoginForm next={next} turnstileSiteKey={turnstileSiteKey()} />
        <p className="mt-4 text-center text-sm font-medium">
          <Link href="/lupa-password" className="brutal-link">
            Lupa password?
          </Link>
        </p>
        <p className="mt-3 text-center text-sm font-medium">
          Belum punya akun?{" "}
          <Link href="/register" className="brutal-link">
            Daftar dulu
          </Link>
        </p>
      </div>

      <div className="mt-4 border-3 border-ink bg-accent p-4 text-sm font-medium shadow-brutal">
        <strong className="block uppercase">Akun demo:</strong>
        <span className="text-ink/70">Masuk pakai email.</span>
        <br />
        Admin → admin@kilat.shop / admin123
        <br />
        User → user@kilat.shop / user123
      </div>
    </div>
  );
}
