import type { Metadata } from "next";
import Link from "next/link";
import { goToCheckout, updateQuantity } from "@/app/actions.ts";
import { currentCart } from "@/lib/cart.ts";
import { formatMoney, normalizeCep } from "@/lib/format.ts";
import { commerce } from "@/lib/store.ts";

export const metadata: Metadata = { title: "Carrinho" };

interface Props {
  searchParams: Promise<{ cep?: string }>;
}

export default async function CartPage({ searchParams }: Props) {
  const cart = await currentCart();
  if (!cart || cart.items.length === 0) {
    return (
      <div className="stack">
        <h1>Carrinho</h1>
        <p className="empty">
          Seu carrinho está vazio. <Link href="/">Ver produtos</Link>
        </p>
      </div>
    );
  }
  const cep = normalizeCep((await searchParams).cep ?? "");
  const quotes = cep ? await commerce.cart.estimateShipping(cart.id, { postalCode: cep, country: "BRA" }).catch(() => []) : null;

  return (
    <div className="pdp">
      <div className="stack">
        <h1>Carrinho</h1>
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {cart.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name ?? `SKU ${item.variantId}`}</td>
                <td>
                  <form action={updateQuantity} className="row">
                    <input type="hidden" name="itemId" value={item.id} />
                    <input name="quantity" type="number" min={0} max={99} defaultValue={item.quantity} className="input" style={{ flex: "none", width: 72 }} aria-label="Quantidade" />
                    <button className="button button-ghost">Atualizar</button>
                  </form>
                </td>
                <td>{formatMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="summary" aria-label="Resumo">
        <span className="row">
          Subtotal <strong style={{ marginLeft: "auto" }}>{formatMoney(cart.subtotal)}</strong>
        </span>
        {cart.discount.amountCents > 0 && (
          <span className="row">
            Descontos <strong style={{ marginLeft: "auto" }}>−{formatMoney(cart.discount)}</strong>
          </span>
        )}
        <form className="row" action="/carrinho">
          <input name="cep" className="input" placeholder="CEP" defaultValue={cep ?? ""} aria-label="CEP para calcular o frete" />
          <button className="button button-ghost">Calcular frete</button>
        </form>
        {quotes &&
          (quotes.length === 0 ? (
            <span className="muted">Nenhuma opção de entrega para este CEP.</span>
          ) : (
            quotes.map((q) => (
              <span key={q.id} className="row">
                {q.service} · {q.estimatedBusinessDays} dias úteis <strong style={{ marginLeft: "auto" }}>{formatMoney(q.price)}</strong>
              </span>
            ))
          ))}
        <span className="row">
          Total <strong style={{ marginLeft: "auto" }}>{formatMoney(cart.total)}</strong>
        </span>
        <form action={goToCheckout}>
          <button className="button button-accent" style={{ width: "100%", justifyContent: "center" }}>
            Finalizar compra
          </button>
        </form>
        <span className="muted" style={{ fontSize: 13 }}>
          O pagamento acontece no checkout da VTEX.
        </span>
      </aside>
    </div>
  );
}
