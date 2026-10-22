import type { Money } from "./commerce/index.ts";

const formatters = new Map<string, Intl.NumberFormat>();

/** 19990 BRL → "R$ 199,90". */
export function formatMoney(money: Money): string {
  let f = formatters.get(money.currency);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { style: "currency", currency: money.currency });
    formatters.set(money.currency, f);
  }
  return f.format(money.amountCents / 100).replace(/\u00a0/g, " ");
}

/** "01001000" or "01001-000" → "01001-000"; anything else → null. */
export function normalizeCep(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
}

/** Strips tags from a product description for plain-text display. */
export function plainText(html: string | null): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
