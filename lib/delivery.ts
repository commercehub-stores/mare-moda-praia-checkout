/** "3bd" → 3 business days; "2d" → 2 days; hours round up to 1 day. */
export function estimateDays(estimate: string): { days: number; business: boolean } {
  const m = estimate.match(/^(\d+)(bd|d|h|m)$/);
  if (!m) return { days: 0, business: true };
  const n = Number(m[1]);
  if (m[2] === "bd") return { days: n, business: true };
  if (m[2] === "d") return { days: n, business: false };
  return { days: Math.max(1, Math.ceil(n / 24)), business: false };
}

/** Delivery date counted from today in São Paulo, skipping weekends for business days. */
export function deliveryDate(estimate: string, from = new Date()): Date {
  const { days, business } = estimateDays(estimate);
  const d = new Date(from.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (!business || (wd !== 0 && wd !== 6)) left--;
  }
  return d;
}

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const short = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" });

/** "Amanhã" / "Sábado" style title plus "sáb, 25 out" subtitle, as in the Figma delivery cards. */
export function deliveryLabel(estimate: string): { title: string; subtitle: string } {
  const date = deliveryDate(estimate);
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diff = Math.round((date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000);
  const name = weekday.format(date);
  const title = diff === 1 ? "Amanhã" : name.charAt(0).toUpperCase() + name.slice(1).replace("-feira", "");
  return { title, subtitle: short.format(date).replace(/\./g, "") };
}

export const cents = (v: number) => ({ amountCents: v, currency: "BRL" });
