import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const IMMUTABLE_1Y = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Las fotos no cambian: evita reoptimizar y re-servir desde el origen.
    minimumCacheTTL: 31536000,
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [32, 48, 64, 96, 128, 256],
  },
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Assets de `public/`: Next no les pone Cache-Control propio, así que sin
      // esto el CDN los revalida contra el origen y se paga transferencia de
      // más. Los nombres derivan del slug y no se reescriben, son inmutables.
      {
        source: "/candidatos/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_1Y }],
      },
      {
        source: "/partidos/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_1Y }],
      },
      {
        source: "/lottie/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_1Y }],
      },
      {
        source: "/:path*.svg",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_1Y }],
      },
      {
        source: "/:path*(.png|.jpg|.jpeg|.webp|.avif)",
        headers: [{ key: "Cache-Control", value: IMMUTABLE_1Y }],
      },
    ];
  },
};

export default nextConfig;
