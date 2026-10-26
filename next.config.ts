import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./security-headers.ts";

/**
 * The checkout layer is its own deploy, served by the storefront under /checkout (Next.js multi-zones:
 * the web app rewrites /checkout/* here). basePath keeps every page and asset under that prefix.
 */
/** Public address of the store this checkout is served under (also used for "Voltar para a loja"). */
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "https://mare-moda-praia-web.vercel.app";

const nextConfig: NextConfig = {
  basePath: "/checkout",
  poweredByHeader: false,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_STORE_URL: STORE_URL },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Server Actions are posted to the store's domain and proxied here: accept that origin.
  experimental: { serverActions: { allowedOrigins: [new URL(STORE_URL).host] } },
};

export default nextConfig;
