"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CART_COOKIE, currentCartId } from "@/lib/cart.ts";
import { CheckoutError, getOrderForm, placeOrder, selectSla, setAddress, setProfile } from "@/lib/checkout/vtex.ts";
import { ORDER_AUTH_COOKIE } from "@/lib/paths.ts";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};
const digits = (s: string) => s.replace(/\D/g, "");

/** Errors come back to the page as ?erro=… so the shopper sees them next to the form. */
function fail(message: string, anchor = ""): never {
  redirect(`/?erro=${encodeURIComponent(message)}${anchor}`);
}

async function requireCart(): Promise<string> {
  const id = await currentCartId();
  if (!id) redirect("/");
  return id;
}

export async function saveContact(form: FormData) {
  const id = await requireCart();
  const name = text(form, "nome").split(/\s+/);
  const firstName = name.shift() ?? "";
  const lastName = name.join(" ");
  const email = text(form, "email");
  const document = digits(text(form, "cpf"));
  const phone = digits(text(form, "telefone"));
  if (!email.includes("@")) fail("Informe um e-mail válido.", "#contato");
  if (!firstName || !lastName) fail("Informe nome e sobrenome.", "#contato");
  if (document.length !== 11) fail("O CPF precisa ter 11 dígitos.", "#contato");
  if (phone.length < 10) fail("Informe o celular com DDD.", "#contato");
  try {
    await setProfile(id, { email, firstName, lastName, document, phone: `+55${phone}` });
  } catch (e) {
    fail(e instanceof CheckoutError ? e.message : "Não foi possível salvar seus dados.", "#contato");
  }
  revalidatePath("/");
  redirect("/#entrega");
}

/** "Buscar" next to the CEP: fills street, neighbourhood, city and state from VTEX's postal-code service. */
export async function findCep(form: FormData) {
  const cep = digits(text(form, "cep"));
  if (cep.length !== 8) fail("O CEP precisa ter 8 dígitos.", "#entrega");
  redirect(`/?cep=${cep}#entrega`);
}

export async function saveAddress(form: FormData) {
  const id = await requireCart();
  const cep = digits(text(form, "cep"));
  const address = {
    receiverName: text(form, "destinatario") || null,
    postalCode: cep,
    street: text(form, "rua"),
    number: text(form, "numero"),
    complement: text(form, "complemento") || null,
    neighborhood: text(form, "bairro"),
    city: text(form, "cidade"),
    state: text(form, "uf").toUpperCase(),
    country: "BRA",
  };
  if (cep.length !== 8 || !address.street || !address.number || !address.city || address.state.length !== 2) fail("Confira CEP, rua, número, cidade e UF.", "#entrega");
  try {
    let orderForm = await setAddress(id, address);
    // Pre-select the cheapest option so the summary shows a real total right away.
    const cheapest = orderForm.shippingData?.logisticsInfo[0]?.slas.slice().sort((a, b) => a.price - b.price)[0];
    if (cheapest && !orderForm.shippingData?.logisticsInfo[0]?.selectedSla) orderForm = await selectSla(orderForm, cheapest.id);
  } catch (e) {
    fail(e instanceof CheckoutError ? e.message : "Não foi possível salvar o endereço.", "#entrega");
  }
  revalidatePath("/");
  redirect("/#entrega");
}

export async function chooseSla(form: FormData) {
  const id = await requireCart();
  const orderForm = await getOrderForm(id);
  if (!orderForm) redirect("/");
  await selectSla(orderForm, text(form, "sla")).catch(() => fail("Essa opção de entrega não está disponível.", "#entrega"));
  revalidatePath("/");
  redirect("/#pagamento");
}

/** Places the order with Pix or Boleto and opens the confirmation. */
export async function pay(form: FormData) {
  const id = await requireCart();
  const paymentSystem = text(form, "paymentSystem");
  let group = "";
  try {
    const placed = await placeOrder(id, paymentSystem);
    group = placed.orderGroup;
    const jar = await cookies();
    jar.set(ORDER_AUTH_COOKIE, placed.authCookie, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 });
    // The cart became an order: the storefront starts a fresh one on the next add-to-bag.
    jar.delete(CART_COOKIE);
  } catch (e) {
    fail(e instanceof CheckoutError ? `A VTEX recusou o pedido: ${e.message}` : "Não foi possível finalizar agora. Tente de novo.", "#pagamento");
  }
  redirect(`/pedido/${group}`);
}
