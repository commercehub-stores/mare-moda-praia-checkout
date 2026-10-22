// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
// Platform-neutral commerce types. Money is always integer cents in `currency`.

export type CurrencyCode = string; // ISO 4217, e.g. "BRL"

export interface Money {
  amountCents: number;
  currency: CurrencyCode;
}

export interface Page<T> {
  items: T[];
  /** Opaque cursor for the next page; null on the last page. */
  nextCursor: string | null;
}

export interface PageRequest {
  cursor?: string;
  limit?: number;
}

// ---------- Catalog ----------

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  price: Money;
  listPrice: Money | null;
  available: boolean;
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryIds: string[];
  images: string[];
  variants: ProductVariant[];
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
}

export interface ProductQuery extends PageRequest {
  categoryId?: string;
  ids?: string[];
}

// ---------- Search ----------

export interface SearchQuery extends PageRequest {
  term: string;
  filters?: Record<string, string[]>;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
}

export interface SearchFacet {
  key: string;
  label: string;
  values: { value: string; label: string; count: number }[];
}

export interface SearchResult extends Page<Product> {
  total: number;
  facets: SearchFacet[];
}

export interface Suggestion {
  term: string;
  productIds: string[];
}

// ---------- Cart ----------

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
  /** Display name and image, when the platform returns them with the cart. */
  name?: string;
  imageUrl?: string | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: Money;
  shipping: Money | null;
  discount: Money;
  total: Money;
}

export interface AddCartItemInput {
  variantId: string;
  quantity: number;
}

export interface ShippingAddress {
  postalCode: string;
  country: string;
}

export interface ShippingQuote {
  id: string;
  carrier: string;
  service: string;
  price: Money;
  estimatedBusinessDays: number;
}

// ---------- Checkout ----------

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  document: string | null;
  phone: string | null;
}

export interface Address extends ShippingAddress {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  recipient: string;
}

export interface PlaceOrderInput {
  cartId: string;
  customer: Omit<Customer, "id">;
  shippingAddress: Address;
  shippingQuoteId: string;
}

export type PaymentMethod =
  | { kind: "pix" }
  | { kind: "boleto" }
  | { kind: "credit_card"; cardToken: string; installments: number };

export interface PaymentInput {
  orderId: string;
  method: PaymentMethod;
  amount: Money;
}

export interface PaymentResult {
  status: "approved" | "pending" | "declined";
  /** Pix copy-paste code, boleto URL, 3DS redirect… depending on the method. */
  action: { kind: "pix"; qrCode: string } | { kind: "boleto"; url: string } | { kind: "redirect"; url: string } | null;
}

// ---------- Orders ----------

export type OrderStatus = "pending_payment" | "paid" | "invoiced" | "shipped" | "delivered" | "canceled";

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  customerId: string;
  items: CartItem[];
  total: Money;
  createdAt: string;
}

// ---------- Webhooks ----------

export type WebhookTopic = "order.created" | "order.updated" | "product.updated" | "inventory.updated";

export interface WebhookEvent {
  topic: WebhookTopic;
  resourceId: string;
  occurredAt: string;
  raw: unknown;
}

export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
}
