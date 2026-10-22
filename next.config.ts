import type { NextConfig } from "next";

/**
 * The checkout layer is its own deploy, served by the storefront under /checkout (Next.js multi-zones:
 * the web app rewrites /checkout/* here). basePath keeps every page and asset under that prefix.
 */
const nextConfig: NextConfig = {
  basePath: "/checkout",
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
