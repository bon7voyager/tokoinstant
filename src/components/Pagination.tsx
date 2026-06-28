import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Server-rendered pager for admin list pages. `baseHref` is the current page URL
 * WITH any active filters but WITHOUT a `page` param (e.g. "/admin/orders?status=PAID");
 * the `page` query is appended here. Renders nothing when there is only one page.
 */
export default function Pagination({
  page,
  totalPages,
  baseHref,
  hash,
}: {
  page: number;
  totalPages: number;
  baseHref: string;
  hash?: string; // optional anchor (without "#") to keep the list section in view
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}page=${p}${hash ? `#${hash}` : ""}`;

  const Btn = ({ to, disabled, children }: { to: number; disabled: boolean; children: React.ReactNode }) => {
    const cls =
      "border-3 border-ink px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm";
    if (disabled) {
      return <span className={cn(cls, "bg-white opacity-40")}>{children}</span>;
    }
    return (
      <Link
        href={href(to)}
        className={cn(cls, "bg-white transition-transform hover:-translate-y-0.5")}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-ink/50">
        Halaman {page} dari {totalPages}
      </span>
      <div className="flex gap-2">
        <Btn to={page - 1} disabled={page <= 1}>
          ← Sebelumnya
        </Btn>
        <Btn to={page + 1} disabled={page >= totalPages}>
          Berikutnya →
        </Btn>
      </div>
    </div>
  );
}
