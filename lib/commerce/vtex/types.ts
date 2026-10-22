// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
// The subset of VTEX response fields the adapter reads (Search, Catalog and Checkout APIs).

export interface VtexSearchProduct {
  productId: string;
  productName: string;
  linkText: string;
  brand?: string | null;
  description?: string | null;
  categoriesIds?: string[];
  items: VtexSearchItem[];
}

export interface VtexSearchItem {
  itemId: string;
  name: string;
  nameComplete?: string;
  referenceId?: { Key: string; Value: string }[] | null;
  images?: { imageUrl: string }[];
  variations?: string[];
  [variation: string]: unknown;
  sellers: { sellerId: string; sellerDefault?: boolean; commertialOffer: { Price: number; ListPrice: number; AvailableQuantity: number; IsAvailable?: boolean } }[];
}

export interface VtexCategoryNode {
  id: number;
  name: string;
  url: string;
  hasChildren: boolean;
  children?: VtexCategoryNode[];
}

export interface VtexOrderForm {
  orderFormId: string;
  value: number;
  items: { id: string; uniqueId: string; quantity: number; seller: string; price: number; sellingPrice: number; listPrice: number; name?: string; imageUrl?: string | null }[];
  totalizers: { id: string; value: number }[];
  storePreferencesData?: { currencyCode?: string };
}

export interface VtexSimulation {
  logisticsInfo: { itemIndex: number; slas: { id: string; name: string; price: number; shippingEstimate: string; deliveryChannel?: string }[] }[];
}
