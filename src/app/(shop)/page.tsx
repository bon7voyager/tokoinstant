import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isPremium, premiumConfig } from "@/lib/membership";
import { buttonStyles } from "@/components/ui";
import { formatIDR } from "@/lib/utils";
import { Marquee } from "@/components/Marquee";
import { StatsCounter } from "@/components/StatsCounter";
import LiveSaleFeed from "@/components/LiveSaleFeed";
import { getHomeStats, getRecentTestimonials } from "@/lib/ratings";
import Testimonials from "@/components/Testimonials";
import { bannerConfig } from "@/lib/banner";
import PromoBanner from "@/components/PromoBanner";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    emoji: "⚡",
    title: "Serba Otomatis",
    desc: "Bayar lalu akun langsung dikirim ke dashboard. Tanpa nunggu admin online.",
    bg: "bg-main",
  },
  {
    emoji: "🛡️",
    title: "Garansi Aktif",
    desc: "Semua akun bergaransi penuh selama masa aktif. Ada kendala? Klaim mudah.",
    bg: "bg-accent",
  },
  {
    emoji: "💸",
    title: "Harga Termurah",
    desc: "Produk digital premium dengan harga paling bersahabat di kantong.",
    bg: "bg-lime",
  },
  {
    emoji: "🕐",
    title: "Buka 24 Jam",
    desc: "Order kapan saja, siang malam. Sistem kami selalu siap melayani.",
    bg: "bg-bubble",
  },
];

const MARQUEE = [
  "🍿 NETFLIX",
  "🎧 SPOTIFY",
  "▶️ YOUTUBE",
  "🏰 DISNEY+",
  "🤖 CHATGPT",
  "🎨 CANVA",
  "📺 PRIME",
  "✂️ CAPCUT",
  "🍎 APPLE MUSIC",
  "📊 MICROSOFT 365",
];


const TRUST = [
  "✅ Pembayaran Aman",
  "🔒 Data Terlindungi",
  "⚡ Pengiriman Instan",
  "🛡️ Bergaransi",
  "💬 CS Responsif",
];

/** Consistent section heading with a chunky neobrutalism eyebrow label. */
function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3 sm:mb-9">
      <div>
        <span className="inline-block border-3 border-ink bg-main px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-ink shadow-brutal-sm">
          {eyebrow}
        </span>
        <h2 className="mt-3 font-display text-3xl leading-[1.05] sm:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default async function HomePage() {
  const homeStats = await getHomeStats();
  const testimonials = await getRecentTestimonials();
  const STATS = [
    { value: homeStats.ordersCompleted, suffix: "", label: "Pesanan Selesai", bg: "bg-secondary text-white" },
    { value: homeStats.satisfiedCustomers, suffix: "", label: "Pelanggan Puas", bg: "bg-main" },
    { value: homeStats.products, suffix: "", label: "Produk Premium", bg: "bg-grape text-white" },
    { value: 24, suffix: "/7", label: "Layanan Otomatis", bg: "bg-lime" },
  ];
  const user = await getCurrentUser();
  const premium = isPremium(user);
  const { fee, days, percent } = premiumConfig();
  const daysLeft = user?.premiumUntil
    ? Math.max(0, Math.ceil((user.premiumUntil.getTime() - Date.now()) / 86_400_000))
    : 0;
  const validUntil = user?.premiumUntil
    ? user.premiumUntil.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
  const ticketSerial = (user?.id ?? "RESELLER").slice(-5).toUpperCase();

  const banner = bannerConfig();

  return (
    <>
      {banner.active && <PromoBanner {...banner} />}

      {/* Hero */}
      <section className="relative overflow-hidden border-b-3 border-ink bg-bubble">
        {/* dotted texture (follows the theme ink colour) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgb(var(--ink)) 1.5px, transparent 1.5px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-block border-3 border-ink bg-white px-3 py-1 text-xs font-bold uppercase text-ink shadow-brutal-sm sm:text-sm">
              🔥 Proses otomatis 24 jam
            </span>
            <h1 className="mt-5 font-display text-[2.6rem] leading-[1.03] sm:text-5xl md:text-6xl">
              Produk Digital
              <br />
              <span className="mt-1 inline-block bg-main px-2 text-ink [box-decoration-break:clone]">
                Murah &amp; Instan
              </span>
            </h1>
            <p className="mt-5 max-w-md text-base font-medium text-ink/80 sm:text-lg">
              Netflix, YouTube Premium, Spotify, dan banyak lagi. Bayar sekarang,
              akun langsung dikirim otomatis ke dashboard kamu.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/produk" className={buttonStyles("ink", "lg")}>
                Belanja Sekarang
              </Link>
              {!user && (
                <Link href="/register" className={buttonStyles("white", "lg")}>
                  Daftar Gratis
                </Link>
              )}
            </div>

          </div>

          {/* Floating brand art (decorative — brands also appear in the marquee/catalog).
              Shown on every size now; cards + bolt scale down on mobile. */}
          <div aria-hidden className="relative mt-2 md:mt-0">
            <div className="absolute -left-1 top-4 rotate-[-6deg] border-3 border-ink bg-secondary px-3 py-2 font-display text-lg text-white shadow-brutal sm:-left-2 sm:top-6 sm:px-4 sm:py-3 sm:text-2xl">
              🍿 Netflix 4K
            </div>
            <div className="absolute right-2 top-0 rotate-[5deg] border-3 border-ink bg-lime px-3 py-2 font-display text-lg text-ink shadow-brutal sm:right-4 sm:px-4 sm:py-3 sm:text-2xl">
              🎧 Spotify
            </div>
            <div className="absolute bottom-4 left-0 rotate-[3deg] border-3 border-ink bg-accent px-3 py-2 font-display text-lg text-ink shadow-brutal sm:bottom-6 sm:left-10 sm:px-4 sm:py-3 sm:text-2xl">
              ▶️ YT Premium
            </div>
            <div className="absolute -right-1 bottom-0 rotate-[-4deg] border-3 border-ink bg-grape px-3 py-2 font-display text-lg text-white shadow-brutal sm:-right-2 sm:px-4 sm:py-3 sm:text-2xl">
              🤖 ChatGPT
            </div>
            <div className="flex h-60 items-center justify-center sm:h-72">
              <span className="font-display text-[6.5rem] leading-none sm:text-[9rem]">⚡</span>
            </div>
          </div>
        </div>
      </section>

      {/* Brand marquee */}
      <Marquee items={MARQUEE} />

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <SectionHeading eyebrow="Keunggulan" title="Kenapa Pilih Kami" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`border-3 border-ink ${f.bg} p-5 text-ink shadow-brutal transition-transform hover:rotate-0 sm:p-6 ${i % 2 === 0 ? "sm:-rotate-1" : "sm:rotate-1"}`}
            >
              <div className="text-4xl">{f.emoji}</div>
              <h3 className="mt-3 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm font-medium text-ink/80">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {TRUST.map((t) => (
            <span
              key={t}
              className="border-3 border-ink bg-white px-3 py-1.5 text-xs font-bold uppercase text-ink shadow-brutal-sm sm:text-sm"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <StatsCounter stats={STATS} />
      </section>

      {/* Testimonials — real recent reviews from buyers */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <SectionHeading eyebrow="Testimoni" title="Kata Mereka" />
          <Testimonials items={testimonials} />
        </section>
      )}

      {/* Membership band — active status for resellers, offer for everyone else */}
      {premium ? (
        <section className="border-y-3 border-ink bg-bubble">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.25fr_1fr] md:items-center">
            {/* Premium gold member card */}
            <div className="relative overflow-hidden border-3 border-ink bg-main text-ink shadow-brutal-xl">
              {/* black header band */}
              <div className="relative flex items-center justify-between border-b-3 border-ink bg-ink px-6 py-3 text-paper">
                <span className="font-display text-sm tracking-[0.12em] text-main">
                  👑 KILAT RESELLER
                </span>
                <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-lime">
                  Premium
                </span>
              </div>

              {/* body */}
              <div className="relative p-6 sm:p-7">
                {/* holder */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink/55">
                    Pemegang
                  </div>
                  <div className="mt-1 truncate font-display text-2xl uppercase sm:text-3xl">
                    {user?.name ?? "Reseller"}
                  </div>
                </div>

                {/* stat tiles */}
                <div className="mt-6 grid grid-cols-3 gap-2.5">
                  <div className="border-3 border-ink bg-paper px-3 py-2 shadow-brutal-sm">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-ink/55">Diskon</div>
                    <div className="font-display text-xl">{percent}%</div>
                  </div>
                  <div className="border-3 border-ink bg-paper px-3 py-2 shadow-brutal-sm">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-ink/55">Berlaku s/d</div>
                    <div className="font-display text-lg leading-tight">{validUntil}</div>
                  </div>
                  <div className="border-3 border-ink bg-paper px-3 py-2 shadow-brutal-sm">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-ink/55">Sisa</div>
                    <div className="font-display text-xl">
                      {daysLeft}
                      <span className="text-xs font-bold"> hari</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink/45">
                  No. Member · RSL-{ticketSerial}
                </div>
              </div>
            </div>

            {/* Status sudah ditampilkan di kartu — di sini fokus ke manfaat + CTA. */}
            <div>
              <h2 className="font-display text-3xl leading-tight sm:text-4xl">
                Hemat {percent}% di Setiap Belanja 🎉
              </h2>
              <p className="mt-3 text-base font-medium text-ink/70">
                Harga reseller dipakai <strong>otomatis</strong> saat checkout. Tinggal
                pilih produk, langsung lebih murah — tanpa kode apa pun.
              </p>
              <Link href="/produk" className={`${buttonStyles("ink", "lg")} mt-5`}>
                Belanja Sekarang →
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="border-y-3 border-ink bg-grape text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="inline-block border-2 border-ink bg-lime px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-ink">
                💎 Program Reseller
              </span>
              <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
                Jadi Reseller, Harga Auto Murah {percent}%
              </h2>
              <p className="mt-3 text-base font-medium text-white/90">
                Bayar <b>{formatIDR(fee)}</b> sekali, semua produk langsung diskon{" "}
                <b>{percent}%</b> selama {days} hari. Pas buat dipakai sendiri atau
                dijual lagi — ambil untung dari selisihnya.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  `🏷️ Diskon ${percent}%`,
                  "⚡ Harga modal",
                  "🔁 Semua produk",
                  `⏱️ ${days} hari`,
                ].map((c) => (
                  <span
                    key={c}
                    className="border-2 border-white/40 bg-white/15 px-2.5 py-1 text-sm font-bold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              className={`${buttonStyles("white", "lg")} shrink-0`}
            >
              {user ? "Jadi Reseller →" : "Mulai Jadi Reseller →"}
            </Link>
          </div>
        </section>
      )}

      {/* Catalog CTA — full catalog lives on /produk */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pb-16">
        <div className="border-3 border-ink bg-main p-8 text-center shadow-brutal sm:p-12">
          <h2 className="font-display text-3xl sm:text-4xl">Siap Belanja? 🛍️</h2>
          <p className="mx-auto mt-3 max-w-md font-medium text-ink/70">
            Jelajahi semua produk digital kami — Netflix, Spotify, YouTube, ChatGPT, dan banyak lagi.
          </p>
          <Link href="/produk" className={`${buttonStyles("ink", "lg")} mt-6`}>
            Lihat Katalog Produk →
          </Link>
        </div>
      </section>

      <LiveSaleFeed />
    </>
  );
}
