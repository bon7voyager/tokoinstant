import type { Metadata } from "next";
import { Space_Grotesk, Archivo_Black } from "next/font/google";
import "./globals.css";
import { ensureSettings } from "@/lib/settings-store";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kilat — Produk Digital Serba Otomatis",
    template: "%s — Kilat",
  },
  description:
    "Beli Netflix, YouTube Premium, Spotify, Canva Pro, ChatGPT Plus & produk digital lain. Proses otomatis 24 jam, akun langsung dikirim setelah bayar. Murah & bergaransi.",
  keywords: [
    "jual netflix murah",
    "spotify premium murah",
    "youtube premium",
    "canva pro",
    "chatgpt plus",
    "produk digital",
    "akun premium murah",
    "kilat shop",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Kilat",
    title: "Kilat — Produk Digital Murah & Instan",
    description: "Akun premium otomatis 24 jam, bergaransi penuh.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kilat",
    description: "Produk digital murah, instan, bergaransi.",
  },
};

// Applies the saved theme before paint to avoid a flash. Default is LIGHT —
// dark only when the user has explicitly toggled it (no system-preference fallback).
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Warm the runtime-settings cache so config readers see admin-saved values.
  await ensureSettings();

  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${archivoBlack.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-paper font-sans">{children}</body>
    </html>
  );
}
