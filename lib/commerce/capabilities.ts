// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
import { LAYER_TYPES, type LayerOrigin, type LayerType, type Platform } from "./quick-shared.ts";

/** Date the checkout matrix below was checked against each platform's official docs. */
export const CAPABILITIES_VALIDATED_AT = "2026-10-21";

export interface LayerCapability {
  /** Origins the panel may offer for this layer. A layer that is not delivered simply has no row. */
  allowedOrigins: readonly LayerOrigin[];
  /** false when the platform's docs did not confirm the matrix; the UI flags it as "a validar". */
  verified: boolean;
  /** Short pt-BR note shown next to the choice. */
  note: string | null;
}

export type PlatformCapabilities = Readonly<Record<LayerType, LayerCapability>>;

const ALL: readonly LayerOrigin[] = ["NATIVE", "QUICK_REDIRECT", "QUICK"];
const REDIRECT_ONLY: readonly LayerOrigin[] = ["NATIVE", "QUICK_REDIRECT"];
const NATIVE_ONLY: readonly LayerOrigin[] = ["NATIVE"];
const NATIVE_OR_QUICK: readonly LayerOrigin[] = ["NATIVE", "QUICK"];
/** The native app is only ever a Quick build (Expo); "not included" means no APP layer row. */
const QUICK_ONLY: readonly LayerOrigin[] = ["QUICK"];

const CHECKOUT: Readonly<Record<Platform, LayerCapability>> = {
  VTEX: {
    allowedOrigins: ALL,
    verified: true,
    note: "Checkout API completa. O pagamento precisa ser enviado até 5 min após criar o pedido.",
  },
  WAKE: { allowedOrigins: ALL, verified: true, note: "Storefront API (GraphQL) cobre carrinho e checkout." },
  SHOPIFY: {
    allowedOrigins: REDIRECT_ONLY,
    verified: true,
    note: "Carrinho pela Storefront API e checkoutUrl (checkout hospedado).",
  },
  NUVEMSHOP: {
    allowedOrigins: REDIRECT_ONLY,
    verified: true,
    note: "Draft Order e checkout_url. Exige nome e e-mail antes do redirect.",
  },
  WOOCOMMERCE: { allowedOrigins: NATIVE_ONLY, verified: false, note: "Store API: validar em loja de teste." },
  UAPPI: { allowedOrigins: NATIVE_ONLY, verified: false, note: "Sem documentação pública. Confirmar com a Uappi." },
  OTHER: { allowedOrigins: NATIVE_ONLY, verified: false, note: "Plataforma própria ou ERP: validar caso a caso." },
};

function build(platform: Platform): PlatformCapabilities {
  const entries = LAYER_TYPES.map((type): [LayerType, LayerCapability] => {
    switch (type) {
      case "CHECKOUT":
        return [type, CHECKOUT[platform]];
      case "APP":
        return [type, { allowedOrigins: QUICK_ONLY, verified: true, note: null }];
      default:
        return [type, { allowedOrigins: NATIVE_OR_QUICK, verified: true, note: null }];
    }
  });
  return Object.freeze(Object.fromEntries(entries) as Record<LayerType, LayerCapability>);
}

const CACHE = new Map<Platform, PlatformCapabilities>();

/** Single source of truth for which layer origins a platform supports. Used by the API and the web. */
export function capabilities(platform: Platform): PlatformCapabilities {
  let value = CACHE.get(platform);
  if (!value) {
    value = build(platform);
    CACHE.set(platform, value);
  }
  return value;
}

export function isOriginAllowed(platform: Platform, type: LayerType, origin: LayerOrigin): boolean {
  return capabilities(platform)[type].allowedOrigins.includes(origin);
}
