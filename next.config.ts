import type { NextConfig } from "next";

function storageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.STORAGE_PUBLIC_HOST;
  if (!raw) return [];
  return raw.split(",").flatMap((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return [];
    try {
      const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")
      ) {
        return [];
      }
      return [{
        protocol: url.protocol.slice(0, -1) as "http" | "https",
        hostname: url.hostname,
        pathname: url.pathname === "/" ? undefined : `${url.pathname.replace(/\/$/, "")}/**`,
      }];
    } catch {
      return [];
    }
  });
}

const securityHeaders = [
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
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  outputFileTracingExcludes: {
    "*": [
      "public/uploads/**",
      "prisma/data/**",
      "**/*.test.ts",
      "vendor/**",
      ".next/cache/**",
    ],
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
