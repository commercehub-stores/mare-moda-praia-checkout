import type { Money, Product, ProductVariant } from "./commerce/index.ts";

/**
 * Maré storefront settings: the VTEX category tree created for the store (department "Maré", id 19)
 * and the commercial rules shown in the layout (Pix discount, installments, free shipping).
 */
export const DEPARTMENT_ID = "19";

export interface Collection {
  slug: string;
  name: string;
  /** VTEX category id; null for virtual collections (novidades, sale). */
  categoryId: string | null;
  description: string;
  /** Quick filters shown as chips, matched against the product name. */
  chips?: { label: string; match: RegExp }[];
}

export const COLLECTIONS: Collection[] = [
  { slug: "novidades", name: "Novidades", categoryId: null, description: "O que acabou de chegar na Maré." },
  {
    slug: "shorts",
    name: "Shorts",
    categoryId: "20",
    description: "Estampados, lisos e boardshorts.",
    chips: [
      { label: "Praia", match: /short praia/i },
      { label: "Casual", match: /short casual/i },
      { label: "Boardshorts", match: /boardshort/i },
      { label: "Cós de elástico", match: /el[aá]stico/i },
    ],
  },
  {
    slug: "sungas",
    name: "Sungas",
    categoryId: "21",
    description: "Larga, média ou fina: escolha o seu corte.",
    chips: [
      { label: "Larga", match: /larga/i },
      { label: "Média", match: /m[eé]dia/i },
      { label: "Fina", match: /fina/i },
    ],
  },
  {
    slug: "camisas",
    name: "Camisas",
    categoryId: "22",
    description: "Linho, viscose e estampas para o fim de tarde.",
    chips: [
      { label: "Manga curta", match: /manga curta/i },
      { label: "Manga longa", match: /manga longa/i },
      { label: "Polo e regata", match: /polo|regata|bata/i },
    ],
  },
  { slug: "camisetas", name: "Camisetas", categoryId: "23", description: "Algodão leve e estampas autorais." },
  { slug: "bermudas", name: "Bermudas", categoryId: "24", description: "Do jeans ao linho, para ir além da areia." },
  { slug: "calcas", name: "Calças", categoryId: "25", description: "Corte reto e tecidos que respiram." },
  { slug: "sale", name: "Sale", categoryId: null, description: "Peças selecionadas com até 50% off." },
];

export const NAV = ["novidades", "shorts", "sungas", "camisas", "camisetas", "sale"]
  .map((slug) => COLLECTIONS.find((c) => c.slug === slug))
  .filter((c): c is Collection => Boolean(c));

export const collectionBySlug = (slug: string) => COLLECTIONS.find((c) => c.slug === slug) ?? null;
export const collectionByCategoryId = (id: string) => COLLECTIONS.find((c) => c.categoryId === id) ?? null;

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "EGG", "36", "38", "40", "42", "44", "46"];
export const FREE_SHIPPING_CENTS = 29_900;
export const PIX_DISCOUNT = 0.05;

export const sizeOf = (v: ProductVariant) => v.attributes["Tamanho"] ?? v.name.split(" ").pop() ?? v.name;

export function sortedVariants(product: Product): ProductVariant[] {
  const rank = (v: ProductVariant) => {
    const i = SIZE_ORDER.indexOf(sizeOf(v));
    return i < 0 ? 99 : i;
  };
  return [...product.variants].sort((a, b) => rank(a) - rank(b));
}

/** The variant whose price represents the product: the cheapest available one. */
export function leadVariant(product: Product): ProductVariant | undefined {
  const available = product.variants.filter((v) => v.available);
  const pool = available.length ? available : product.variants;
  return [...pool].sort((a, b) => a.price.amountCents - b.price.amountCents)[0];
}

/** Each SKU carries its own copy of the product photos (different ids, same file name): keep one of each. */
export function productPhotos(product: Product): string[] {
  const seen = new Set<string>();
  return product.images.filter((url) => {
    const name = new URL(url, "https://x").pathname.split("/").pop() ?? url;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

export const pixPrice =(m: Money): Money => ({ ...m, amountCents: Math.round(m.amountCents * (1 - PIX_DISCOUNT)) });

/** 6x from R$ 300, 3x from R$ 100, otherwise à vista — the rule shown in the Figma cards. */
export function installments(m: Money): { count: number; each: Money } | null {
  const count = m.amountCents >= 30_000 ? 6 : m.amountCents >= 10_000 ? 3 : 1;
  if (count === 1) return null;
  return { count, each: { ...m, amountCents: Math.round(m.amountCents / count) } };
}

export function discountPercent(v: ProductVariant | undefined): number {
  if (!v?.listPrice || v.listPrice.amountCents <= v.price.amountCents) return 0;
  return Math.round((1 - v.price.amountCents / v.listPrice.amountCents) * 100);
}

/** Cart lines come as "Product name Size"; split them for display. */
export function splitLineName(name: string | undefined): { title: string; size: string | null } {
  if (!name) return { title: "Produto", size: null };
  const parts = name.trim().split(/\s+/);
  const last = parts.at(-1) ?? "";
  if (SIZE_ORDER.includes(last)) {
    const title = parts.slice(0, -1).join(" ");
    const half = title.length / 2;
    // VTEX may repeat the product name in nameComplete ("Short X Short X M").
    const dedup = title.length % 2 === 1 && title.slice(0, Math.floor(half)) === title.slice(Math.ceil(half)) ? title.slice(0, Math.floor(half)) : title;
    return { title: dedup, size: last };
  }
  return { title: name, size: null };
}
