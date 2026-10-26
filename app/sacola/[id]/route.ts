import { NextResponse } from "next/server";

/**
 * Old hand-off URL (/checkout/sacola/{orderFormId}). It no longer adopts the cart from the URL: anyone holding
 * such a link could open someone else's cart. Store and checkout share the domain, so the checkout reads the
 * store's httpOnly cart cookie directly; this route only forwards old links to /checkout.
 */
export function GET() {
  // Relative Location: behind the storefront's rewrite, an absolute URL would point at this deploy's own host.
  return new NextResponse(null, { status: 307, headers: { Location: "/checkout" } });
}
