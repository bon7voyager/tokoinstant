import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isPremium } from "@/lib/membership";
import { buttonStyles } from "@/components/ui";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b-3 border-ink bg-main">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center border-3 border-ink bg-ink text-lg text-main shadow-brutal-sm">
            ⚡
          </span>
          <span className="font-display text-xl leading-none tracking-tight">
            KILAT<span className="text-secondary">.SHOP</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {user ? (
            <UserMenu
              user={{
                name: user.name,
                email: user.email,
                role: user.role,
                balance: user.balance,
                premium: isPremium(user),
              }}
            />
          ) : (
            <>
              <Link href="/login" className={buttonStyles("white", "sm")}>
                Masuk
              </Link>
              <Link href="/register" className={buttonStyles("ink", "sm")}>
                Daftar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
