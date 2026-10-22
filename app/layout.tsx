import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentCart } from "@/lib/cart.ts";
import { quickConfig } from "@/lib/config.ts";
import "./globals.css";

export const metadata: Metadata = { title: { default: quickConfig.storeName, template: `%s · ${quickConfig.storeName}` } };
// Catalog and cart are read on every request (no VTEX calls at build time).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cart = await currentCart().catch(() => null);
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  return (
    <html lang="pt-BR">
      <body>
        <header className="header">
          <div className="container header-row">
            <Link href="/" className="logo">
              {quickConfig.storeName}
            </Link>
            <span className="muted">Checkout · Beta</span>
            <Link href="/carrinho" className="button button-ghost">
              Carrinho{count > 0 ? ` (${count})` : ""}
            </Link>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
