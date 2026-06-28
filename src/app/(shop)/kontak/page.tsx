import Link from "next/link";
import type { Metadata } from "next";
import { contactInfo } from "@/lib/contact";
import { buttonStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hubungi Kami",
  description: "Hubungi admin Kilat via WhatsApp, email, Instagram, atau Telegram.",
};

export default async function KontakPage() {
  const c = contactInfo();

  const channels: {
    emoji: string;
    title: string;
    value: string;
    href: string;
    bg: string;
    external: boolean;
  }[] = [];
  if (c.waLink)
    channels.push({ emoji: "💬", title: "WhatsApp", value: c.waDisplay, href: c.waLink, bg: "bg-lime", external: true });
  if (c.email)
    channels.push({ emoji: "✉️", title: "Email", value: c.email, href: `mailto:${c.email}`, bg: "bg-main", external: false });
  if (c.instagram)
    channels.push({ emoji: "📸", title: "Instagram", value: `@${c.instagram}`, href: c.igLink, bg: "bg-bubble", external: true });
  if (c.telegram)
    channels.push({ emoji: "✈️", title: "Telegram", value: `@${c.telegram}`, href: c.tgLink, bg: "bg-accent", external: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="brutal-link text-sm">
        ← Kembali ke beranda
      </Link>
      <h1 className="mt-4 font-display text-4xl leading-tight">Hubungi Kami 👋</h1>
      <p className="mt-2 max-w-xl font-medium text-ink/70">
        Ada pertanyaan sebelum beli, atau butuh bantuan dengan pesanan? Pilih channel
        yang paling nyaman buat kamu — admin siap membantu.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {channels.map((ch) => (
          <a
            key={ch.title}
            href={ch.href}
            target={ch.external ? "_blank" : undefined}
            rel={ch.external ? "noopener noreferrer" : undefined}
            className={`flex items-center gap-4 border-3 border-ink ${ch.bg} p-5 shadow-brutal transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center border-3 border-ink bg-surface text-2xl">
              {ch.emoji}
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg">{ch.title}</div>
              <div className="truncate text-sm font-bold">{ch.value}</div>
            </div>
            <span className="ml-auto text-xl font-bold">→</span>
          </a>
        ))}
      </div>

      <div className="mt-6 border-3 border-ink bg-surface p-5 shadow-brutal">
        <div className="text-sm font-bold uppercase tracking-wide text-ink/60">
          Jam Operasional
        </div>
        <div className="mt-1 font-display text-xl">🕐 {c.hours}</div>
        <p className="mt-2 text-sm font-medium text-ink/60">
          Pembelian produk diproses <strong>otomatis 24 jam</strong>. Bantuan dari
          admin di luar jam operasional akan dibalas setelahnya.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/cara-order" className={buttonStyles("white", "md")}>
          Cara Order
        </Link>
        <Link href="/cara-order#faq" className={buttonStyles("white", "md")}>
          Lihat FAQ
        </Link>
        <Link href="/produk" className={buttonStyles("ink", "md")}>
          Belanja Sekarang
        </Link>
      </div>
    </div>
  );
}
