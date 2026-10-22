// Headless VTEX checkout for the "Versão Quick" checkout layer.
// The vendored Commerce Adapter (lib/commerce) keeps placeOrder/sendPayment out of scope; this module is the
// layer's own extension, built on the public Checkout and Payments endpoints (no App Key involved):
//   orderForm → clientProfileData → shippingData (address + SLA) → paymentData → transaction
//   → POST payments to vtexpayments (within 5 min) → gatewayCallback → order-group.
import { quickConfig } from "../config.ts";

const ACCOUNT = quickConfig.account;
const BASE = `https://${ACCOUNT}.vtexcommercestable.com.br`;
const PAYMENTS = `https://${ACCOUNT}.vtexpayments.com.br`;
const SC = quickConfig.salesChannel;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface Raw {
  data: unknown;
  setCookies: string[];
}

async function request(method: string, url: string, body?: unknown, cookie?: string): Promise<Raw> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: "manual",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON (e.g. empty callback response)
  }
  if (!res.ok && res.status !== 204 && res.status !== 302) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message ?? text.slice(0, 300);
    throw new CheckoutError(message || `VTEX ${res.status}`, res.status);
  }
  return { data, setCookies: res.headers.getSetCookie?.() ?? [] };
}

// ---------- orderForm shape (only what the screens use) ----------

export interface VtexSla {
  id: string;
  name: string;
  price: number;
  shippingEstimate: string;
  deliveryChannel?: string;
}
export interface VtexAddress {
  addressType?: string;
  receiverName: string | null;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  street: string;
  number: string | null;
  neighborhood: string;
  complement: string | null;
}
export interface OrderForm {
  orderFormId: string;
  value: number;
  items: { uniqueId: string; id: string; name: string; skuName?: string; quantity: number; sellingPrice: number; price: number; listPrice: number; imageUrl: string | null; detailUrl?: string }[];
  totalizers: { id: string; name: string; value: number }[];
  clientProfileData: { email: string | null; firstName: string | null; lastName: string | null; document: string | null; phone: string | null } | null;
  shippingData: { selectedAddresses: VtexAddress[]; logisticsInfo: { itemIndex: number; selectedSla: string | null; slas: VtexSla[] }[] } | null;
  paymentData: { paymentSystems: { id: number; name: string; groupName: string }[]; installmentOptions: { paymentSystem: string; installments: { count: number; value: number; total: number; hasInterestRate: boolean }[] }[] };
  messages: { text: string; status: string }[];
}

export async function getOrderForm(id: string): Promise<OrderForm | null> {
  try {
    return (await request("GET", `${BASE}/api/checkout/pub/orderForm/${encodeURIComponent(id)}?sc=${SC}`)).data as OrderForm;
  } catch (error) {
    if (error instanceof CheckoutError && (error.status === 400 || error.status === 404)) return null;
    throw error;
  }
}

export interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  document: string;
  phone: string;
}

export async function setProfile(id: string, p: Profile): Promise<OrderForm> {
  return (
    await request("POST", `${BASE}/api/checkout/pub/orderForm/${id}/attachments/clientProfileData`, {
      ...p,
      documentType: "cpf",
      isCorporate: false,
    })
  ).data as OrderForm;
}

/** ViaCEP-like lookup served by VTEX: street, neighborhood, city, state for a CEP. */
export async function lookupCep(cep: string): Promise<Partial<VtexAddress> | null> {
  try {
    return (await request("GET", `${BASE}/api/checkout/pub/postal-code/BRA/${cep.replace(/\D/g, "")}`)).data as Partial<VtexAddress>;
  } catch {
    return null;
  }
}

export async function setAddress(id: string, address: VtexAddress): Promise<OrderForm> {
  return (
    await request("POST", `${BASE}/api/checkout/pub/orderForm/${id}/attachments/shippingData`, {
      clearAddressIfPostalCodeNotFound: false,
      selectedAddresses: [{ ...address, addressType: "residential", country: "BRA" }],
    })
  ).data as OrderForm;
}

export async function selectSla(form: OrderForm, slaId: string): Promise<OrderForm> {
  const shipping = form.shippingData;
  if (!shipping?.selectedAddresses.length) throw new CheckoutError("Informe o endereço antes de escolher a entrega", 400);
  return (
    await request("POST", `${BASE}/api/checkout/pub/orderForm/${form.orderFormId}/attachments/shippingData`, {
      clearAddressIfPostalCodeNotFound: false,
      selectedAddresses: shipping.selectedAddresses,
      logisticsInfo: shipping.logisticsInfo.map((l) => ({ itemIndex: l.itemIndex, selectedSla: slaId, selectedDeliveryChannel: "delivery" })),
    })
  ).data as OrderForm;
}

/** Sets the payment method so VTEX applies payment-based promotions (e.g. 5% no Pix) to the totals. */
export async function setPayment(form: OrderForm, paymentSystem: string, installments = 1): Promise<OrderForm> {
  return (
    await request("POST", `${BASE}/api/checkout/pub/orderForm/${form.orderFormId}/attachments/paymentData`, {
      payments: [{ paymentSystem, referenceValue: form.value, value: form.value, installments }],
    })
  ).data as OrderForm;
}

export interface PlacedOrder {
  orderGroup: string;
  orderIds: string[];
  /** Cookie pair VTEX issues for the buyer (Vtex_CHKO_Auth…); needed for the callback and to read the order. */
  authCookie: string;
}

function pickCookies(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0] ?? "")
    .filter((kv) => /^(Vtex_CHKO_Auth|CheckoutOrderFormOwnership)/.test(kv))
    .join("; ");
}

/**
 * Places the order and pays it with a method that needs no card data (Pix, Boleto) — the whole sequence runs
 * server-side, well inside VTEX's 5-minute window between transaction and payment.
 */
export async function placeOrder(orderFormId: string, paymentSystem: string): Promise<PlacedOrder> {
  let form = await getOrderForm(orderFormId);
  if (!form) throw new CheckoutError("Sacola expirada", 404);
  form = await setPayment(form, paymentSystem);
  const value = form.value;

  const tx = await request("POST", `${BASE}/api/checkout/pub/orderForm/${orderFormId}/transaction`, {
    referenceId: orderFormId,
    savePersonalData: false,
    optinNewsLetter: false,
    value,
    referenceValue: value,
    interestValue: 0,
  });
  const data = tx.data as {
    orderGroup?: string;
    orders?: { orderId: string; orderGroup: string }[];
    id?: string;
    merchantTransactions?: { transactionId: string; merchantName: string }[];
    messages?: { text: string }[];
  };
  const orderGroup = data.orderGroup ?? data.orders?.[0]?.orderGroup;
  const transactionId = data.merchantTransactions?.[0]?.transactionId ?? data.id;
  if (!orderGroup || !transactionId) throw new CheckoutError(data.messages?.[0]?.text ?? "A VTEX não criou o pedido", 422);
  const authCookie = pickCookies(tx.setCookies);

  await request("POST", `${PAYMENTS}/api/pub/transactions/${transactionId}/payments?orderId=${orderGroup}`, [
    {
      paymentSystem: Number(paymentSystem),
      installments: 1,
      currencyCode: "BRL",
      value,
      installmentsInterestRate: 0,
      installmentsValue: value,
      referenceValue: value,
      fields: {},
      transaction: { id: transactionId, merchantName: data.merchantTransactions?.[0]?.merchantName ?? ACCOUNT.toUpperCase() },
    },
  ]);
  await request("POST", `${BASE}/api/checkout/pub/gatewayCallback/${orderGroup}`, undefined, authCookie);
  return { orderGroup, orderIds: (data.orders ?? []).map((o) => o.orderId), authCookie };
}

export interface PlacedOrderView {
  orderId: string;
  status: string;
  statusDescription: string;
  value: number;
  creationDate: string;
  items: { id: string; name: string; quantity: number; sellingPrice: number; imageUrl: string | null }[];
  totals: { id: string; name: string; value: number }[];
  clientProfileData: { firstName: string | null; email: string | null };
  shippingData: { address: VtexAddress | null; logisticsInfo: { selectedSla: string; slas: VtexSla[]; shippingEstimateDate?: string | null }[] };
  paymentData: { transactions: { payments: { paymentSystemName: string; group: string; url: string | null; value: number }[] }[] };
}

export async function getOrderGroup(orderGroup: string, authCookie: string): Promise<PlacedOrderView[] | null> {
  try {
    return (await request("GET", `${BASE}/api/checkout/pub/orders/order-group/${orderGroup}`, undefined, authCookie)).data as PlacedOrderView[];
  } catch {
    return null;
  }
}
