import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export function EmptyState({
  emoji = "📦",
  title,
  desc,
  cta,
}: {
  emoji?: string;
  title: string;
  desc?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="border-3 border-ink bg-white p-10 text-center shadow-brutal">
      <div className="text-5xl">{emoji}</div>
      <p className="mt-3 font-display text-lg">{title}</p>
      {desc && <p className="mt-1 text-sm font-medium text-ink/60">{desc}</p>}
      {cta && (
        <Link href={cta.href} className={`${buttonStyles("main", "md")} mt-5`}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
