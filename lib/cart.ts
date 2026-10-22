import { cookies } from "next/headers";
import { commerce } from "./store.ts";

/** The VTEX orderFormId lives in an httpOnly cookie; the browser never handles cart data directly. */
export const CART_COOKIE = "qs_cart";

export async function currentCartId(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

export async function currentCart() {
  const id = await currentCartId();
  return id ? commerce.cart.get(id) : null;
}

/** The existing cart, or a new one (and its cookie). */
export async function ensureCartId(): Promise<string> {
  const existing = await currentCart();
  if (existing) return existing.id;
  const cart = await commerce.cart.create();
  (await cookies()).set(CART_COOKIE, cart.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return cart.id;
}
