import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Entrega" };

/**
 * Skeleton (Beta): address and delivery option. Today the shipping quote lives on the cart page and the
 * purchase ends in the native VTEX checkout. The headless flow (address → payment → placeOrder) needs
 * capabilities().CHECKOUT to allow QUICK and the adapter's placeOrder/sendPayment, which are out of scope.
 */
export default function DeliveryPage() {
  return (
    <div className="stack">
      <h1>Entrega</h1>
      <p className="empty">
        Tela em construção (Beta). Por enquanto, calcule o frete no <Link href="/carrinho">carrinho</Link> e finalize no checkout da VTEX.
      </p>
    </div>
  );
}
