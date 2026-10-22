"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentCartId, ensureCartId } from "@/lib/cart.ts";
import { commerce } from "@/lib/store.ts";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export async function addToCart(form: FormData) {
  const variantId = text(form, "variantId");
  const quantity = Math.max(1, Math.min(99, Number(text(form, "quantity")) || 1));
  if (!variantId) return;
  const cartId = await ensureCartId();
  await commerce.cart.addItem(cartId, { variantId, quantity });
  redirect("/carrinho");
}

export async function updateQuantity(form: FormData) {
  const cartId = await currentCartId();
  const itemId = text(form, "itemId");
  const quantity = Math.max(0, Math.min(99, Number(text(form, "quantity")) || 0));
  if (!cartId || !itemId) return;
  await commerce.cart.updateItem(cartId, itemId, quantity);
  revalidatePath("/carrinho");
}

/** Redirect mode: the cart goes to the native VTEX checkout, where payment happens. */
export async function goToCheckout() {
  const cartId = await currentCartId();
  if (!cartId) redirect("/carrinho");
  const { url } = await commerce.checkout.getCheckoutUrl(cartId);
  redirect(url);
}
