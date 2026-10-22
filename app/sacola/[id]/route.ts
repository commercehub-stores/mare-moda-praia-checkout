import { type NextRequest, NextResponse } from "next/server";
import { CART_COOKIE } from "@/lib/cart.ts";
import { getOrderForm } from "@/lib/checkout/vtex.ts";

/**
 * Hand-off from the storefront: /checkout/sacola/{orderFormId} adopts that cart (same cookie the web layer uses)
 * and opens the checkout. Works even when the two zones are tested on different hosts.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const valid = /^[a-f0-9]{32}$/i.test(id) && (await getOrderForm(id).catch(() => null)) !== null;
  const response = NextResponse.redirect(new URL("/checkout", request.url));
  if (valid) response.cookies.set(CART_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
