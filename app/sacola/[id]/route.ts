import { NextResponse } from "next/server";
import { CART_COOKIE } from "@/lib/cart.ts";
import { getOrderForm } from "@/lib/checkout/vtex.ts";

/**
 * Hand-off from the storefront: /checkout/sacola/{orderFormId} adopts that cart (same cookie the web layer uses)
 * and opens the checkout. Same domain as the store, so the cookie is shared.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const valid = /^[a-f0-9]{32}$/i.test(id) && (await getOrderForm(id).catch(() => null)) !== null;
  // Relative Location on purpose: behind the storefront's rewrite, request.url carries this deploy's own host,
  // and an absolute redirect would send the shopper there, away from the domain where the cart cookie was set.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/checkout" } });
  if (valid) response.cookies.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
