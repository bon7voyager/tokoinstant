/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // Allow product photo uploads (default server-action body limit is 1MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
