import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ---- Users ----
  const adminPassword = await bcrypt.hash("admin123", 10);
  const userPassword = await bcrypt.hash("user123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@kilat.shop" },
    update: {},
    create: {
      email: "admin@kilat.shop",
      name: "Admin Kilat",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "user@kilat.shop" },
    update: {},
    create: {
      email: "user@kilat.shop",
      name: "Budi Pelanggan",
      password: userPassword,
      role: "USER",
    },
  });

  console.log(`✅ Admin: admin@kilat.shop / admin123`);
  console.log(`✅ User : user@kilat.shop / user123`);

  // ---- Categories ----
  const categoryData = [
    { name: "Streaming Film", slug: "streaming-film", emoji: "🎬" },
    { name: "Musik", slug: "musik", emoji: "🎵" },
    { name: "AI Tools", slug: "ai-tools", emoji: "🤖" },
    { name: "Produktivitas", slug: "produktivitas", emoji: "⚡" },
    { name: "Edukasi", slug: "edukasi", emoji: "📚" },
  ];

  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, emoji: c.emoji },
      create: c,
    });
    categories[c.slug] = cat.id;
  }

  // ---- Products ----
  const productData = [
    // ---- Streaming Film ----
    {
      name: "Netflix Premium 1 Bulan (Sharing)",
      slug: "netflix-premium-1-bulan",
      description:
        "Akun Netflix Premium 4K UHD, 1 profil private. Bisa di TV, HP, laptop. Garansi penuh selama masa aktif.",
      price: 27000,
      badge: "TERLARIS",
      categorySlug: "streaming-film",
      stockCount: 12,
    },
    {
      name: "Netflix Premium 1 Tahun (Sharing)",
      slug: "netflix-premium-1-tahun",
      description:
        "Hemat setahun penuh! Netflix Premium 4K, 1 profil private, garansi sepanjang masa aktif.",
      price: 280000,
      badge: "HEMAT",
      categorySlug: "streaming-film",
      stockCount: 5,
    },
    {
      name: "Disney+ Hotstar 1 Bulan",
      slug: "disney-hotstar-1-bulan",
      description:
        "Semua film Disney, Marvel, Star Wars, dan olahraga premium. Kualitas Full HD. Garansi aktif.",
      price: 20000,
      badge: null,
      categorySlug: "streaming-film",
      stockCount: 8,
    },
    {
      name: "Prime Video 1 Bulan",
      slug: "prime-video-1-bulan",
      description:
        "Ribuan film & serial Amazon Originals. Streaming sampai 4K. Sharing private bergaransi.",
      price: 18000,
      badge: null,
      categorySlug: "streaming-film",
      stockCount: 7,
    },
    {
      name: "HBO Max 1 Bulan",
      slug: "hbo-max-1-bulan",
      description:
        "Serial & film blockbuster HBO, Warner, dan DC. Kualitas terbaik, akun sharing bergaransi.",
      price: 24000,
      badge: "BARU",
      categorySlug: "streaming-film",
      stockCount: 6,
    },
    {
      name: "Vidio Platinum 1 Bulan",
      slug: "vidio-platinum-1-bulan",
      description:
        "Liga Inggris, Champions, film & serial Indonesia. Tanpa iklan, kualitas terbaik.",
      price: 22000,
      badge: null,
      categorySlug: "streaming-film",
      stockCount: 9,
    },
    {
      name: "WeTV VIP 1 Bulan",
      slug: "wetv-vip-1-bulan",
      description:
        "Drama China, Korea, dan Asia terbaru tanpa iklan. Update tercepat, akun bergaransi.",
      price: 15000,
      badge: "HEMAT",
      categorySlug: "streaming-film",
      stockCount: 10,
    },

    // ---- Musik ----
    {
      name: "Spotify Premium 1 Bulan",
      slug: "spotify-premium-1-bulan",
      description:
        "Musik tanpa iklan, kualitas tinggi, download offline, skip tanpa batas. Garansi aktif.",
      price: 18000,
      badge: "TERLARIS",
      categorySlug: "musik",
      stockCount: 14,
    },
    {
      name: "YouTube Premium 1 Bulan",
      slug: "youtube-premium-1-bulan",
      description:
        "Nonton tanpa iklan, download video, putar di background. Sudah termasuk YouTube Music.",
      price: 16000,
      badge: "TERLARIS",
      categorySlug: "musik",
      stockCount: 14,
    },
    {
      name: "Apple Music 1 Bulan",
      slug: "apple-music-1-bulan",
      description:
        "100 juta lagu lossless tanpa iklan, lirik real-time, download offline. Sharing bergaransi.",
      price: 17000,
      badge: null,
      categorySlug: "musik",
      stockCount: 8,
    },

    // ---- AI Tools ----
    {
      name: "ChatGPT Plus 1 Bulan",
      slug: "chatgpt-plus-1-bulan",
      description:
        "Akses model GPT terbaru, lebih cepat, prioritas saat ramai. Akun sharing private bergaransi.",
      price: 45000,
      badge: "HOT",
      categorySlug: "ai-tools",
      stockCount: 6,
    },
    {
      name: "Google Gemini Advanced 1 Bulan",
      slug: "gemini-advanced-1-bulan",
      description:
        "Model Gemini paling canggih + 2TB Google One. Cocok untuk kerja, riset, dan belajar.",
      price: 40000,
      badge: "BARU",
      categorySlug: "ai-tools",
      stockCount: 5,
    },

    // ---- Produktivitas ----
    {
      name: "Canva Pro 1 Tahun",
      slug: "canva-pro-1-tahun",
      description:
        "Semua template premium, background remover, brand kit, jutaan elemen Pro. Via invite ke emailmu.",
      price: 35000,
      badge: "TERLARIS",
      categorySlug: "produktivitas",
      stockCount: 10,
    },
    {
      name: "CapCut Pro 1 Bulan",
      slug: "capcut-pro-1-bulan",
      description:
        "Edit video tanpa watermark, efek & template premium, cloud storage lega. Cocok untuk konten kreator.",
      price: 19000,
      badge: null,
      categorySlug: "produktivitas",
      stockCount: 11,
    },
    {
      name: "Microsoft 365 1 Tahun",
      slug: "microsoft-365-1-tahun",
      description:
        "Word, Excel, PowerPoint, Outlook + 1TB OneDrive. Lisensi setahun penuh, bisa di banyak perangkat.",
      price: 60000,
      badge: "HEMAT",
      categorySlug: "produktivitas",
      stockCount: 7,
    },

    // ---- Edukasi ----
    {
      name: "Duolingo Super 1 Bulan",
      slug: "duolingo-super-1-bulan",
      description:
        "Belajar bahasa tanpa iklan, latihan tanpa batas, dan koreksi error. Akun bergaransi.",
      price: 20000,
      badge: null,
      categorySlug: "edukasi",
      stockCount: 8,
    },
  ];

  for (const p of productData) {
    const { stockCount, categorySlug, ...rest } = p;
    // Seed a realistic starting view count (more for hero/best-seller badges) so
    // the catalog looks alive on a fresh DB. Only set on create — re-seeding keeps
    // whatever real views have accumulated since.
    const seededViews =
      Math.floor(Math.random() * 1200) +
      (p.badge === "TERLARIS" || p.badge === "HOT"
        ? 2000
        : p.badge === "BARU"
          ? 400
          : 250);
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: rest.name,
        description: rest.description,
        price: rest.price,
        badge: rest.badge,
        categoryId: categories[categorySlug],
      },
      create: {
        ...rest,
        views: seededViews,
        categoryId: categories[categorySlug],
      },
    });

    // Only add stock if product has none yet (so re-seeding doesn't pile up)
    const existing = await prisma.stock.count({
      where: { productId: product.id },
    });
    if (existing === 0) {
      const stocks = Array.from({ length: stockCount }, (_, i) => ({
        productId: product.id,
        secret: `${product.slug.replace(/-/g, "")}${i + 1}@mail.com:Kilat#${1000 + i}`,
        note: "Profil: 1 | Durasi: sesuai paket",
      }));
      await prisma.stock.createMany({ data: stocks });
    }
  }

  console.log(`✅ ${productData.length} products + stock created`);

  // ---- Coupons (demo) ----
  const couponData = [
    { code: "HEMAT10", type: "PERCENT" as const, value: 10, minSpend: 0, maxDiscount: 15000, quota: null, isActive: true },
    { code: "POTONG5K", type: "FIXED" as const, value: 5000, minSpend: 20000, maxDiscount: null, quota: 100, isActive: true },
    { code: "NEWUSER", type: "PERCENT" as const, value: 20, minSpend: 25000, maxDiscount: 25000, quota: 50, isActive: true },
  ];
  for (const c of couponData) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }
  console.log(`✅ ${couponData.length} demo coupons created (HEMAT10, POTONG5K, NEWUSER)`);

  console.log("🌱 Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
