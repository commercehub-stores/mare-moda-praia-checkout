// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
import type { Platform } from "./quick-shared.ts";
import type {
  AdapterContext,
  CartCapability,
  CatalogCapability,
  CheckoutCapability,
  CommerceAdapter,
  CustomersCapability,
  OrdersCapability,
  SearchCapability,
  WebhooksCapability,
} from "./adapter.ts";

export class NotImplementedError extends Error {
  constructor(
    readonly platform: Platform,
    readonly operation: string,
  ) {
    super(`${operation} is not implemented for ${platform}`);
    this.name = "NotImplementedError";
  }
}

/** Builds a capability object whose every method throws NotImplementedError. */
function notImplemented<T extends object>(platform: Platform, group: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      return () => {
        throw new NotImplementedError(platform, `${group}.${prop}`);
      };
    },
  });
}

/**
 * Base class for real adapters: subclasses replace the capability groups they support,
 * and anything left untouched fails loudly instead of silently returning nothing.
 */
export abstract class NotImplementedAdapter implements CommerceAdapter {
  abstract readonly platform: Platform;

  constructor(protected readonly context: AdapterContext) {}

  get catalog(): CatalogCapability {
    return notImplemented(this.platform, "catalog");
  }
  get search(): SearchCapability {
    return notImplemented(this.platform, "search");
  }
  get cart(): CartCapability {
    return notImplemented(this.platform, "cart");
  }
  get checkout(): CheckoutCapability {
    return notImplemented(this.platform, "checkout");
  }
  get orders(): OrdersCapability {
    return notImplemented(this.platform, "orders");
  }
  get customers(): CustomersCapability {
    return notImplemented(this.platform, "customers");
  }
  get webhooks(): WebhooksCapability {
    return notImplemented(this.platform, "webhooks");
  }
}
