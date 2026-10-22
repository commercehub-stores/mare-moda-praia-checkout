// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
import type { Platform } from "./quick-shared.ts";
import type {
  AddCartItemInput,
  Cart,
  Category,
  Customer,
  Order,
  Page,
  PageRequest,
  PaymentInput,
  PaymentResult,
  PlaceOrderInput,
  Product,
  ProductQuery,
  SearchQuery,
  SearchResult,
  ShippingAddress,
  ShippingQuote,
  Suggestion,
  WebhookEvent,
  WebhookRequest,
  WebhookTopic,
} from "./types.ts";

/** What an adapter is built with. Credentials arrive already decrypted; adapters never persist them. */
export interface AdapterContext {
  storeId: string;
  platformAccount: string | null;
  credentials: Readonly<Record<string, string>>;
}

export interface CatalogCapability {
  getProducts(query: ProductQuery): Promise<Page<Product>>;
  getProduct(idOrSlug: string): Promise<Product | null>;
  getCategories(): Promise<Category[]>;
}

export interface SearchCapability {
  search(query: SearchQuery): Promise<SearchResult>;
  suggest(term: string): Promise<Suggestion[]>;
}

export interface CartCapability {
  create(): Promise<Cart>;
  get(cartId: string): Promise<Cart | null>;
  addItem(cartId: string, item: AddCartItemInput): Promise<Cart>;
  /** quantity 0 removes the item. */
  updateItem(cartId: string, itemId: string, quantity: number): Promise<Cart>;
  estimateShipping(cartId: string, address: ShippingAddress): Promise<ShippingQuote[]>;
}

export interface CheckoutCapability {
  /** Redirect mode (QUICK_REDIRECT): hand the cart to the platform's hosted checkout. */
  getCheckoutUrl(cartId: string): Promise<{ url: string }>;
  /** Headless mode (QUICK): create the order, then pay it. Only where capabilities() allows QUICK. */
  placeOrder(input: PlaceOrderInput): Promise<Order>;
  sendPayment(input: PaymentInput): Promise<PaymentResult>;
}

export interface OrdersCapability {
  getOrder(orderId: string): Promise<Order | null>;
  listOrders(page: PageRequest & { customerId?: string }): Promise<Page<Order>>;
}

export interface CustomersCapability {
  getCustomer(customerId: string): Promise<Customer | null>;
  findCustomerByEmail(email: string): Promise<Customer | null>;
}

export interface WebhooksCapability {
  register(topics: WebhookTopic[], callbackUrl: string): Promise<void>;
  verify(request: WebhookRequest): boolean;
  parse(request: WebhookRequest): WebhookEvent;
}

/**
 * The single interface every Quick layer (Next front, checkout, app) talks to.
 * One implementation per platform; a new platform means a new adapter, not a new front.
 */
export interface CommerceAdapter {
  readonly platform: Platform;
  readonly catalog: CatalogCapability;
  readonly search: SearchCapability;
  readonly cart: CartCapability;
  readonly checkout: CheckoutCapability;
  readonly orders: OrdersCapability;
  readonly customers: CustomersCapability;
  readonly webhooks: WebhooksCapability;
}
