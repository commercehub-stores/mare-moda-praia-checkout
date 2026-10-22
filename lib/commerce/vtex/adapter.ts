// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
import type { AdapterContext, CartCapability, CatalogCapability, CheckoutCapability, SearchCapability } from "../adapter.ts";
import { NotImplementedAdapter } from "../not-implemented.ts";
import type { Cart, Category, Money, Page, Product, ProductQuery, SearchQuery, SearchResult, ShippingQuote, Suggestion } from "../types.ts";
import { totalFromResources, type VtexHost, VtexHttp, VtexHttpError } from "./http.ts";
import type { VtexCategoryNode, VtexOrderForm, VtexSearchProduct, VtexSimulation } from "./types.ts";

export interface VtexAdapterOptions {
  /** Sales channel (trade policy). Default 1. */
  salesChannel?: number;
  currency?: string;
  /** Host of the native checkout the shopper is sent to, e.g. "www.loja.com.br". Default "{account}.myvtex.com". */
  checkoutHost?: string;
  fetch?: typeof fetch;
  baseUrl?: (host: VtexHost, account: string) => string;
}

/** VTEX search returns at most 50 items per call (_to − _from ≤ 49). */
const MAX_PAGE = 50;
const DEFAULT_PAGE = 24;
const SORT = { relevance: null, price_asc: "OrderByPriceASC", price_desc: "OrderByPriceDESC", newest: "OrderByReleaseDateDESC" } as const;

const cents = (reais: number) => Math.round(reais * 100);

/** "3bd" / "5d" → days; "4h" and anything shorter round up to 1. */
export function businessDays(estimate: string): number {
  const match = estimate.match(/^(\d+)(bd|d|h|m)$/);
  if (!match) return 0;
  const n = Number(match[1]);
  return match[2] === "bd" || match[2] === "d" ? n : Math.max(1, Math.ceil(n / 24));
}

/**
 * The VTEX Commerce Adapter: catalog, search, cart (orderForm) and the redirect to the native checkout.
 * Every call here uses public storefront routes, so templates run with no App Key. Headless checkout
 * (placeOrder/sendPayment), orders, customers and webhooks are out of scope and throw NotImplementedError.
 */
export class VtexAdapter extends NotImplementedAdapter {
  readonly platform = "VTEX" as const;
  private readonly http: VtexHttp;
  private readonly sc: number;
  private readonly currency: string;

  constructor(
    context: AdapterContext,
    private readonly options: VtexAdapterOptions = {},
  ) {
    super(context);
    if (!context.platformAccount) throw new Error("A loja não tem a conta VTEX (account name) cadastrada");
    this.http = new VtexHttp({ account: context.platformAccount, fetch: options.fetch, baseUrl: options.baseUrl });
    this.sc = options.salesChannel ?? 1;
    this.currency = options.currency ?? "BRL";
  }

  private money(amountCents: number): Money {
    return { amountCents, currency: this.currency };
  }

  private toProduct(p: VtexSearchProduct): Product {
    const images = p.items.flatMap((item) => item.images?.map((img) => img.imageUrl) ?? []);
    return {
      id: p.productId,
      slug: p.linkText,
      name: p.productName,
      description: p.description || null,
      brand: p.brand || null,
      categoryIds: (p.categoriesIds ?? []).flatMap((path) => path.split("/").filter(Boolean)).filter((id, i, all) => all.indexOf(id) === i),
      images: [...new Set(images)],
      variants: p.items.map((item) => {
        const seller = item.sellers.find((s) => s.sellerDefault) ?? item.sellers[0];
        const offer = seller?.commertialOffer;
        const attributes: Record<string, string> = {};
        for (const name of item.variations ?? []) {
          const value = item[name];
          if (Array.isArray(value) && typeof value[0] === "string") attributes[name] = value[0];
        }
        return {
          id: item.itemId,
          sku: item.referenceId?.[0]?.Value ?? item.itemId,
          name: item.nameComplete ?? item.name,
          price: this.money(cents(offer?.Price ?? 0)),
          listPrice: offer && offer.ListPrice > offer.Price ? this.money(cents(offer.ListPrice)) : null,
          available: (offer?.AvailableQuantity ?? 0) > 0,
          attributes,
        };
      }),
    };
  }

  /** GET /api/catalog_system/pub/products/search with fq/ft/O and _from/_to. */
  private async searchProducts(params: { fq?: string[]; ft?: string; sort?: string | null; cursor?: string; limit?: number }) {
    const from = Math.max(0, Number(params.cursor ?? 0) || 0);
    const size = Math.min(MAX_PAGE, Math.max(1, params.limit ?? DEFAULT_PAGE));
    const qs = new URLSearchParams({ _from: String(from), _to: String(from + size - 1), sc: String(this.sc) });
    for (const fq of params.fq ?? []) qs.append("fq", fq);
    if (params.ft) qs.set("ft", params.ft);
    if (params.sort) qs.set("O", params.sort);
    const { data, headers } = await this.http.request<VtexSearchProduct[]>(`/api/catalog_system/pub/products/search?${qs.toString()}`);
    const total = totalFromResources(headers.get("resources")) ?? from + data.length;
    const next = from + data.length;
    return { items: data.map((p) => this.toProduct(p)), total, nextCursor: data.length === size && next < total ? String(next) : null };
  }

  override get catalog(): CatalogCapability {
    return {
      getProducts: async (query: ProductQuery): Promise<Page<Product>> => {
        const fq = [
          ...(query.categoryId ? [`C:/${query.categoryId}/`] : []),
          ...(query.ids ?? []).map((id) => `productId:${id}`),
        ];
        const { items, nextCursor } = await this.searchProducts({ fq, cursor: query.cursor, limit: query.limit });
        return { items, nextCursor };
      },
      getProduct: async (idOrSlug: string): Promise<Product | null> => {
        // Numeric → product ID filter; otherwise the product's link text (".../{slug}/p").
        const path = /^\d+$/.test(idOrSlug)
          ? `/api/catalog_system/pub/products/search?fq=productId:${idOrSlug}&sc=${this.sc}`
          : `/api/catalog_system/pub/products/search/${encodeURIComponent(idOrSlug)}/p?sc=${this.sc}`;
        const { data } = await this.http.request<VtexSearchProduct[]>(path);
        return data[0] ? this.toProduct(data[0]) : null;
      },
      getCategories: async (): Promise<Category[]> => {
        const { data } = await this.http.request<VtexCategoryNode[]>("/api/catalog_system/pub/category/tree/3");
        const out: Category[] = [];
        const walk = (nodes: VtexCategoryNode[], parentId: string | null) => {
          for (const node of nodes) {
            out.push({ id: String(node.id), parentId, name: node.name, slug: new URL(node.url, "https://x").pathname.replace(/^\/+|\/+$/g, "") });
            walk(node.children ?? [], String(node.id));
          }
        };
        walk(data, null);
        return out;
      },
    };
  }

  override get search(): SearchCapability {
    return {
      search: async (query: SearchQuery): Promise<SearchResult> => {
        const fq = (query.filters?.["category"] ?? []).map((id) => `C:/${id}/`);
        const result = await this.searchProducts({ ft: query.term || undefined, fq, sort: SORT[query.sort ?? "relevance"], cursor: query.cursor, limit: query.limit });
        // Facets would need the facets endpoint; the storefront template filters by category only for now.
        return { ...result, facets: [] };
      },
      suggest: async (term: string): Promise<Suggestion[]> => {
        if (!term.trim()) return [];
        const { items } = await this.searchProducts({ ft: term.trim(), limit: 5 });
        return [{ term: term.trim(), productIds: items.map((p) => p.id) }];
      },
    };
  }

  private toCart(form: VtexOrderForm): Cart {
    const totalizer = (id: string) => form.totalizers.find((t) => t.id === id)?.value ?? null;
    const currency = form.storePreferencesData?.currencyCode ?? this.currency;
    const money = (amountCents: number): Money => ({ amountCents, currency });
    return {
      id: form.orderFormId,
      items: form.items.map((item) => ({
        id: item.uniqueId,
        variantId: item.id,
        quantity: item.quantity,
        unitPrice: money(item.sellingPrice),
        total: money(item.sellingPrice * item.quantity),
        ...(item.name ? { name: item.name } : {}),
        ...(item.imageUrl !== undefined ? { imageUrl: item.imageUrl } : {}),
      })),
      subtotal: money(totalizer("Items") ?? 0),
      shipping: totalizer("Shipping") === null ? null : money(totalizer("Shipping") ?? 0),
      discount: money(Math.abs(totalizer("Discounts") ?? 0)),
      total: money(form.value),
    };
  }

  private async orderForm(cartId: string): Promise<VtexOrderForm> {
    const { data } = await this.http.request<VtexOrderForm>(`/api/checkout/pub/orderForm/${encodeURIComponent(cartId)}`);
    return data;
  }

  override get cart(): CartCapability {
    return {
      create: async () => {
        const { data } = await this.http.request<VtexOrderForm>(`/api/checkout/pub/orderForm?forceNewCart=true&sc=${this.sc}`);
        return this.toCart(data);
      },
      get: async (cartId) => {
        try {
          return this.toCart(await this.orderForm(cartId));
        } catch (error) {
          if (error instanceof VtexHttpError && (error.status === 404 || error.status === 400)) return null;
          throw error;
        }
      },
      addItem: async (cartId, item) => {
        const { data } = await this.http.request<VtexOrderForm>(`/api/checkout/pub/orderForm/${encodeURIComponent(cartId)}/items?sc=${this.sc}`, {
          method: "POST",
          body: { orderItems: [{ id: item.variantId, quantity: item.quantity, seller: "1" }] },
        });
        return this.toCart(data);
      },
      updateItem: async (cartId, itemId, quantity) => {
        // The update endpoint addresses items by index; resolve it from the item's uniqueId.
        const form = await this.orderForm(cartId);
        const index = form.items.findIndex((i) => i.uniqueId === itemId);
        if (index < 0) throw new Error("Item não está no carrinho");
        const { data } = await this.http.request<VtexOrderForm>(`/api/checkout/pub/orderForm/${encodeURIComponent(cartId)}/items/update`, {
          method: "POST",
          body: { orderItems: [{ index, quantity }] },
        });
        return this.toCart(data);
      },
      estimateShipping: async (cartId, address): Promise<ShippingQuote[]> => {
        const form = await this.orderForm(cartId);
        if (form.items.length === 0) return [];
        const { data } = await this.http.request<VtexSimulation>(`/api/checkout/pub/orderForms/simulation?sc=${this.sc}`, {
          method: "POST",
          body: { items: form.items.map((i) => ({ id: i.id, quantity: i.quantity, seller: i.seller })), postalCode: address.postalCode, country: address.country },
        });
        // One quote per SLA offered for every item; the price is the sum across items.
        const bySla = new Map<string, { name: string; price: number; days: number; count: number }>();
        for (const info of data.logisticsInfo) {
          for (const sla of info.slas) {
            const current = bySla.get(sla.id) ?? { name: sla.name, price: 0, days: 0, count: 0 };
            bySla.set(sla.id, { name: sla.name, price: current.price + sla.price, days: Math.max(current.days, businessDays(sla.shippingEstimate)), count: current.count + 1 });
          }
        }
        return [...bySla.entries()]
          .filter(([, sla]) => sla.count === data.logisticsInfo.length)
          .map(([id, sla]) => ({ id, carrier: sla.name, service: sla.name, price: this.money(sla.price), estimatedBusinessDays: sla.days }))
          .sort((a, b) => a.price.amountCents - b.price.amountCents);
      },
    };
  }

  override get checkout(): CheckoutCapability {
    const base = super.checkout;
    return {
      /** "How to assemble the cart URL" (help.vtex.com): /checkout/cart/add?sc=&sku=&qty=&seller= per item. */
      getCheckoutUrl: async (cartId) => {
        const form = await this.orderForm(cartId);
        const qs = new URLSearchParams({ sc: String(this.sc) });
        for (const item of form.items) {
          qs.append("sku", item.id);
          qs.append("qty", String(item.quantity));
          qs.append("seller", item.seller);
        }
        const host = this.options.checkoutHost ?? `${this.http.account}.myvtex.com`;
        return { url: `https://${host}/checkout/cart/add?${qs.toString()}` };
      },
      placeOrder: (input) => base.placeOrder(input),
      sendPayment: (input) => base.sendPayment(input),
    };
  }
}
