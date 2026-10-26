import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CheckoutBar } from "@/components/chrome.tsx";
import { getOrderGroup } from "@/lib/checkout/vtex.ts";
import { cents, deliveryLabel } from "@/lib/delivery.ts";
import { formatMoney } from "@/lib/format.ts";
import { splitLineName } from "@/lib/mare.ts";
import { asset, ORDER_AUTH_COOKIE, STORE_URL } from "@/lib/paths.ts";

export const metadata: Metadata = { title: "Pedido confirmado" };

interface Props {
  params: Promise<{ group: string }>;
}

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Order confirmation (Figma "Pedido confirmado"): hero with status, delivery tracker, the items. */
export default async function OrderPage({ params }: Props) {
  const { group } = await params;
  // Order groups are numeric; anything else would only echo attacker text on a trusted page.
  if (!/^\d{6,20}$/.test(group)) notFound();
  const auth = (await cookies()).get(ORDER_AUTH_COOKIE)?.value ?? "";
  const orders = await getOrderGroup(group, auth);
  const order = orders?.[0];

  if (!order) {
    return (
      <>
        <CheckoutBar step={3} />
        <main className="co-empty">
          <h1 className="display">Pedido {group} recebido</h1>
          <p className="muted">Os detalhes ficam visíveis só no navegador que fez a compra. Você recebe tudo por e-mail.</p>
          <a href={STORE_URL} className="btn btn-coral">
            Voltar para a loja
          </a>
        </main>
      </>
    );
  }

  const payment = order.paymentData.transactions[0]?.payments[0];
  const method = payment?.paymentSystemName ?? "";
  const isBoleto = /boleto/i.test(method);
  const paid = ["payment-approved", "ready-for-handling", "handling", "invoiced"].includes(order.status);
  const logistics = order.shippingData.logisticsInfo[0];
  const sla = logistics?.slas.find((s) => s.id === logistics.selectedSla);
  const arrival = sla ? deliveryLabel(sla.shippingEstimate) : null;
  const address = order.shippingData.address;
  const name = order.clientProfileData.firstName ?? "";

  const steps = [
    { label: paid ? "Pagamento aprovado" : "Aguardando pagamento", note: `hoje · ${time.format(new Date(order.creationDate))}`, state: paid ? "done" : "current" },
    { label: "Separando seu pedido", note: "até amanhã", state: paid ? "current" : "todo" },
    { label: "Saiu para entrega", note: arrival ? "a caminho" : "", state: "todo" },
    { label: "Entregue", note: arrival?.subtitle ?? "", state: "todo" },
  ] as const;

  return (
    <>
      <CheckoutBar step={3} />
      <section className="ok-hero">
        <span className="ok-check">
          <img src={asset("/icons/co-check.svg")} alt="" width={28} height={28} />
        </span>
        <p className="ok-meta">
          PEDIDO #{order.orderId} · {paid ? `PAGO COM ${method.toUpperCase()}` : `${method.toUpperCase()} · AGUARDANDO PAGAMENTO`}
        </p>
        <h1 className="display">
          {paid ? "Já está a caminho" : "Pedido feito"}
          <br />
          {paid ? `da areia${name ? `, ${name}` : ""}.` : `${name ? `${name}, ` : ""}falta só pagar.`}
        </h1>
        <p className="ok-sub">
          Mandamos tudo para o seu e-mail.
          {arrival && address ? ` Chega ${arrival.title.toLowerCase() === "amanhã" ? "amanhã" : arrival.subtitle}, em ${address.neighborhood}.` : ""}
        </p>
        <div className="ok-ctas">
          {payment?.url && (
            <a href={payment.url} className="btn btn-coral" target="_blank" rel="noreferrer">
              {isBoleto ? "Abrir boleto" : "Ver código Pix"}
            </a>
          )}
          <a href={STORE_URL} className="btn btn-outline-light">
            Continuar comprando
          </a>
        </div>
        <svg className="ok-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40 C 240 90, 480 0, 720 30 S 1200 80, 1440 20 L1440 80 L0 80 Z" fill="var(--shell)" />
        </svg>
      </section>

      <main className="ok-main">
        <section className="ok-card" aria-labelledby="t-track">
          <h2 id="t-track" className="display">
            Acompanhe sua entrega
          </h2>
          <ol className="ok-track">
            {steps.map((s) => (
              <li key={s.label} data-state={s.state}>
                <span className="ok-dot">{s.state === "done" && <img src={asset("/icons/co-check-white.svg")} alt="" width={14} height={14} />}</span>
                <strong>{s.label}</strong>
                <span className="muted">{s.note}</span>
              </li>
            ))}
          </ol>
          <div className="ok-items">
            {order.items.map((item) => {
              const { title, size } = splitLineName(item.name);
              return (
                <div key={item.id} className="ok-item">
                  <img src={item.imageUrl?.replace(/-55-55\//, "-200-250/") ?? ""} alt="" />
                  <div>
                    <strong>{title}</strong>
                    <span className="muted">
                      {size ? `Tam. ${size} · ` : ""}
                      {item.quantity} un.
                    </span>
                  </div>
                  <b>{formatMoney(cents(item.sellingPrice * item.quantity))}</b>
                </div>
              );
            })}
          </div>
          <div className="ok-total">
            <span>Total {method ? `· ${method}` : ""}</span>
            <strong>{formatMoney(cents(order.value))}</strong>
          </div>
        </section>
        <aside className="ok-side">
          <div className="ok-card ok-ugc">
            <h2 className="display">#VerãoMaré</h2>
            <p className="muted">Poste seu look marcando @mare.modapraia e apareça na nossa vitrine.</p>
            <a href={STORE_URL} className="btn btn-outline">
              Ver a coleção
            </a>
          </div>
          <div className="ok-card">
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Pedido criado na VTEX pela camada <b>checkout-vtex · Versão Quick</b>. Grupo {group}.
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}
