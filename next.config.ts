import type { NextConfig } from "next";

function storageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.STORAGE_PUBLIC_HOST;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const url = entry.includes("://") ? new URL(entry) : new URL(`https://${entry}`);
      return {
        protocol: (url.protocol.replace(":", "") || "https") as "http" | "https",
        hostname: url.hostname,
        pathname: url.pathname === "/" ? undefined : `${url.pathname.replace(/\/$/, "")}/**`,
      };
    });
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: *.facebook.com *.fbcdn.net",
  "media-src 'self' https:",
  "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://graph.facebook.com",
  "frame-src https://www.facebook.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "report-uri /api/security/csp-report",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: storageRemotePatterns(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
