import type { Metadata } from "next";
import Link from "next/link";
import { chooseSla, findCep, pay, saveAddress, saveContact } from "@/app/actions.ts";
import { CheckoutBar } from "@/components/chrome.tsx";
import { Turnstile } from "@/components/turnstile.tsx";
import { currentCartId } from "@/lib/cart.ts";
import { DEMO_PAYMENT_SYSTEM, getOrderForm, lookupCep, type OrderForm, paymentSystemFor, setPayment } from "@/lib/checkout/vtex.ts";
import { cents, deliveryLabel } from "@/lib/delivery.ts";
import { formatMoney } from "@/lib/format.ts";
import { splitLineName } from "@/lib/mare.ts";
import { asset, STORE_URL } from "@/lib/paths.ts";

export const metadata: Metadata = { title: "Checkout" };

interface Props {
  searchParams: Promise<{ editar?: string; cep?: string; pagamento?: string; erro?: string }>;
}

const METHODS = {
  pix: { id: "125", label: "Pix", icon: "co-pix.svg", tag: "-5%" },
  cartao: { id: "2", label: "Cartão", icon: "co-card.svg", tag: "6x sem juros" },
  boleto: { id: "6", label: "Boleto", icon: "co-boleto.svg", tag: null },
} as const;
type MethodKey = keyof typeof METHODS;

const totalizer = (form: OrderForm, id: string) => form.totalizers.find((t) => t.id === id)?.value ?? null;

export default async function CheckoutPage({ searchParams }: Props) {
  const q = await searchParams;
  const cartId = await currentCartId();
  let form = cartId ? await getOrderForm(cartId).catch(() => null) : null;

  if (!form || form.items.length === 0) {
    return (
      <>
        <CheckoutBar step={1} />
        <main className="co-empty">
          <h1 className="display">Sua sacola está vazia</h1>
          <p className="muted">Escolha suas peças na loja e volte aqui para finalizar.</p>
          <a href={STORE_URL} className="btn btn-coral">
            Voltar para a loja
          </a>
        </main>
      </>
    );
  }

  const method: MethodKey = q.pagamento === "cartao" || q.pagamento === "boleto" ? q.pagamento : "pix";
  const profile = form.clientProfileData;
  const hasContact = Boolean(profile?.email && profile.firstName && profile.document);
  const address = form.shippingData?.selectedAddresses[0];
  const hasAddress = Boolean(address?.street && address.number);
  const logistics = form.shippingData?.logisticsInfo[0];
  const selectedSla = logistics?.slas.find((s) => s.id === logistics.selectedSla) ?? null;
  const ready = hasContact && hasAddress && Boolean(selectedSla);

  // The chosen method goes to VTEX so payment promotions (5% no Pix) show up in the totals.
  const paymentId = paymentSystemFor(METHODS[method].id);
  if (ready && method !== "cartao" && form.paymentData.paymentSystems.some((p) => String(p.id) === paymentId)) {
    form = (await setPayment(form, paymentId).catch(() => form)) ?? form;
  }

  const editContact = q.editar === "contato" || !hasContact;
  const editAddress = q.editar === "entrega" || !hasAddress;
  const cepLookup = q.cep ? await lookupCep(q.cep) : null;
  const items = form.items;
  const subtotal = totalizer(form, "Items") ?? 0;
  const shipping = totalizer(form, "Shipping");
  const discounts = totalizer(form, "Discounts") ?? 0;
  const count = items.filter((i) => !i.availability || i.availability === "available").reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <CheckoutBar step={2} />
      <main className="co-main">
        <div className="co-col">
          {q.erro && (
            <p className="co-error" role="alert">
              {q.erro}
            </p>
          )}

          {hasContact && profile && (
            <div className="co-hello">
              <span className="co-avatar">{`${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase()}</span>
              <div>
                <h1 className="display">Que bom te ver, {profile.firstName}.</h1>
                <p className="muted">{ready ? "Seus dados e endereço já estão aqui. Falta só escolher como pagar." : "Faltam poucos passos para fechar seu pedido."}</p>
              </div>
            </div>
          )}

          <section className="co-card" id="contato" aria-labelledby="t-contato">
            <div className="co-card-head">
              <span className={hasContact && !editContact ? "co-num done" : "co-num"}>{hasContact && !editContact ? <img src={asset("/icons/co-check-white.svg")} alt="" width={16} height={16} /> : 1}</span>
              <div>
                <h2 id="t-contato" className="display">
                  Contato
                </h2>
              </div>
              {hasContact && !editContact && (
                <Link href="/?editar=contato#contato" className="co-edit">
                  <img src={asset("/icons/co-pencil.svg")} alt="" width={14} height={14} />
                  Alterar
                </Link>
              )}
            </div>
            {editContact ? (
              <form action={saveContact} className="co-form">
                <label>
                  E-mail
                  <input name="email" type="email" required autoComplete="email" defaultValue={profile?.email ?? ""} placeholder="voce@email.com" />
                </label>
                <label>
                  Nome completo
                  <input name="nome" required autoComplete="name" defaultValue={[profile?.firstName, profile?.lastName].filter(Boolean).join(" ")} placeholder="Nome e sobrenome" />
                </label>
                <div className="co-row">
                  <label>
                    CPF
                    <input name="cpf" required inputMode="numeric" autoComplete="off" defaultValue={profile?.document ?? ""} placeholder="000.000.000-00" />
                  </label>
                  <label>
                    Celular
                    <input name="telefone" required inputMode="tel" autoComplete="tel-national" defaultValue={profile?.phone?.replace(/^\+55/, "") ?? ""} placeholder="(21) 98888-1234" />
                  </label>
                </div>
                <button className="btn btn-ink">Continuar para entrega</button>
              </form>
            ) : (
              <p className="co-line">
                <strong>{profile?.email}</strong>
                <span className="muted">{profile?.phone?.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}</span>
              </p>
            )}
          </section>

          <section className="co-card" id="entrega" aria-labelledby="t-entrega" data-disabled={!hasContact || undefined}>
            <div className="co-card-head">
              <span className={hasAddress && selectedSla && !editAddress ? "co-num done" : "co-num"}>{hasAddress && selectedSla && !editAddress ? <img src={asset("/icons/co-check-white.svg")} alt="" width={16} height={16} /> : 2}</span>
              <div>
                <h2 id="t-entrega" className="display">
                  Entrega
                </h2>
                {hasAddress && !editAddress && address && (
                  <p className="muted">
                    {address.street}, {address.number}
                    {address.complement ? ` · ${address.complement}` : ""} · {address.neighborhood}, {address.city}
                  </p>
                )}
              </div>
              {hasAddress && !editAddress && (
                <Link href="/?editar=entrega#entrega" className="co-edit">
                  <img src={asset("/icons/co-pencil.svg")} alt="" width={14} height={14} />
                  Alterar
                </Link>
              )}
            </div>

            {hasContact && editAddress && (
              <>
                <form action={findCep} className="co-form co-cep">
                  <label>
                    CEP
                    <input name="cep" required inputMode="numeric" autoComplete="postal-code" defaultValue={q.cep ?? address?.postalCode ?? ""} placeholder="00000-000" />
                  </label>
                  <button className="btn btn-outline">Buscar</button>
                </form>
                {(q.cep || address?.postalCode) && (
                  <form action={saveAddress} className="co-form">
                    <input type="hidden" name="cep" value={q.cep ?? address?.postalCode ?? ""} />
                    <label>
                      Rua
                      <input name="rua" required autoComplete="address-line1" defaultValue={cepLookup?.street ?? address?.street ?? ""} />
                    </label>
                    <div className="co-row">
                      <label>
                        Número
                        <input name="numero" required defaultValue={address?.number ?? ""} />
                      </label>
                      <label>
                        Complemento
                        <input name="complemento" autoComplete="address-line2" defaultValue={address?.complement ?? ""} placeholder="ap, bloco…" />
                      </label>
                    </div>
                    <div className="co-row co-row-3">
                      <label>
                        Bairro
                        <input name="bairro" required defaultValue={cepLookup?.neighborhood ?? address?.neighborhood ?? ""} />
                      </label>
                      <label>
                        Cidade
                        <input name="cidade" required defaultValue={cepLookup?.city ?? address?.city ?? ""} />
                      </label>
                      <label>
                        UF
                        <input name="uf" required maxLength={2} defaultValue={cepLookup?.state ?? address?.state ?? ""} />
                      </label>
                    </div>
                    <label>
                      Quem recebe
                      <input name="destinatario" defaultValue={address?.receiverName ?? [profile?.firstName, profile?.lastName].filter(Boolean).join(" ")} />
                    </label>
                    <button className="btn btn-ink">Ver opções de entrega</button>
                  </form>
                )}
              </>
            )}

            {hasAddress && !editAddress && logistics && (
              <form action={chooseSla} className="co-slas">
                {logistics.slas.length === 0 && <p className="muted">Nenhuma opção de entrega para este endereço.</p>}
                {[...logistics.slas]
                  .sort((a, b) => a.price - b.price)
                  .map((sla, i, all) => {
                    const label = deliveryLabel(sla.shippingEstimate);
                    const fastest = all.length > 1 && sla === [...all].sort((a, b) => parseInt(a.shippingEstimate) - parseInt(b.shippingEstimate))[0];
                    const selected = sla.id === logistics.selectedSla;
                    return (
                      <button key={sla.id} name="sla" value={sla.id} className="co-sla" aria-pressed={selected}>
                        <span className="co-sla-top">
                          <img src={asset(/expres/i.test(sla.name) ? "/icons/co-bolt-20.svg" : "/icons/co-truck-20.svg")} alt="" width={20} height={20} />
                          {fastest && !selected && <span className="co-pill-coral">Mais rápida</span>}
                          {selected && (
                            <span className="co-tick">
                              <img src={asset("/icons/co-check-11.svg")} alt="" width={11} height={11} />
                            </span>
                          )}
                        </span>
                        <span className="display co-sla-title">{label.title}</span>
                        <span className="muted">
                          {label.subtitle} · {sla.name}
                        </span>
                        <strong className={sla.price === 0 ? "co-free" : undefined}>{sla.price === 0 ? "Grátis" : formatMoney(cents(sla.price))}</strong>
                      </button>
                    );
                  })}
              </form>
            )}
          </section>

          <section className="co-card co-card-strong" id="pagamento" aria-labelledby="t-pagamento" data-disabled={!ready || undefined}>
            <div className="co-card-head">
              <span className="co-num">3</span>
              <div>
                <h2 id="t-pagamento" className="display">
                  Pagamento
                </h2>
                <p className="muted">Escolha a forma de pagar</p>
              </div>
            </div>
            {ready && (
              <>
                <nav className="co-tabs" aria-label="Formas de pagamento">
                  {(Object.keys(METHODS) as MethodKey[]).map((key) => {
                    const m = METHODS[key];
                    return (
                      <Link key={key} href={`/?pagamento=${key}#pagamento`} aria-current={key === method ? "true" : undefined} scroll={false}>
                        <img src={asset(`/icons/${m.icon}`)} alt="" width={16} height={16} />
                        {m.label}
                        {m.tag && <span className={key === "pix" ? "co-tag-sea" : "co-tag"}>{m.tag}</span>}
                      </Link>
                    );
                  })}
                </nav>
                <div className="co-pay-panel">
                  {method === "pix" && (
                    <ol className="co-howto">
                      <li>
                        <span>1</span>Confirme o pedido em “Pagar com Pix”
                      </li>
                      <li>
                        <span>2</span>Abra o app do banco e leia o QR Code ou cole o código
                      </li>
                      <li>
                        <span>3</span>Pronto: a aprovação é na hora e o pedido segue para separação
                      </li>
                    </ol>
                  )}
                  {method === "boleto" && <p className="muted">O boleto vence em 3 dias úteis. Separamos seu pedido assim que o pagamento for compensado (até 2 dias úteis).</p>}
                  {DEMO_PAYMENT_SYSTEM && method !== "cartao" && (
                    <p className="co-demo">
                      <b>Modo demonstração:</b> o pedido é criado de verdade na VTEX com o pagamento pendente e nada é cobrado. Com o gateway de {METHODS[method].label} conectado, este passo gera a cobrança real.
                    </p>
                  )}
                  {method === "cartao" && (
                    <p className="muted">
                      Cartão em até 6x sem juros entra quando o adquirente for conectado à conta VTEX. Nesta demonstração, finalize com <Link href="/?pagamento=pix#pagamento">Pix</Link> ou <Link href="/?pagamento=boleto#pagamento">Boleto</Link>.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="co-summary" aria-label="Resumo do pedido">
          <div className="co-sum-head">
            <h2 className="display">Sua sacola</h2>
            <span>
              {count} {count === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="co-sum-items">
            {items.map((item) => {
              const { title, size } = splitLineName(item.name);
              return (
                <div key={item.uniqueId} className="co-sum-item">
                  <img src={item.imageUrl?.replace(/-55-55\//, "-400-500/") ?? ""} alt="" />
                  <strong>{title}</strong>
                  <span>
                    <span>
                      {size ? `Tam. ${size}` : ""} · {item.quantity} un.
                    </span>
                    {item.availability && item.availability !== "available" ? <b className="sun">Esgotado · sai do pedido</b> : <b>{formatMoney(cents(item.sellingPrice * item.quantity))}</b>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="co-sum-rows">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(cents(subtotal))}</strong>
            </div>
            <div>
              <span>{selectedSla ? `Entrega · ${deliveryLabel(selectedSla.shippingEstimate).title.toLowerCase()}` : "Entrega"}</span>
              <strong className={shipping === 0 ? "sun" : undefined}>{shipping === null ? "calcular" : shipping === 0 ? "Grátis" : formatMoney(cents(shipping))}</strong>
            </div>
            {discounts !== 0 && (
              <div>
                <span>{method === "pix" ? "Desconto Pix (5%)" : "Descontos"}</span>
                <strong className="sun">− {formatMoney(cents(Math.abs(discounts)))}</strong>
              </div>
            )}
          </div>
          <hr />
          <div className="co-sum-total">
            <div>
              <strong>{method === "pix" ? "Total no Pix" : "Total"}</strong>
              {discounts !== 0 && <span className="sun">você economiza {formatMoney(cents(Math.abs(discounts)))}</span>}
            </div>
            <span className="display">{formatMoney(cents(form.value))}</span>
          </div>
          {method !== "cartao" && (
            <form action={pay}>
              <input type="hidden" name="paymentSystem" value={METHODS[method].id} />
              <Turnstile />
              <button className="btn btn-coral btn-block co-pay" disabled={!ready}>
                <img src={asset("/icons/co-lock-white.svg")} alt="" width={18} height={18} />
                {ready ? `Pagar ${formatMoney(cents(form.value))} com ${METHODS[method].label}` : "Preencha os dados para pagar"}
              </button>
            </form>
          )}
          <div className="co-trust">
            <span>
              <img src={asset("/icons/co-shield.svg")} alt="" width={14} height={14} />
              Pagamento seguro
            </span>
            <span>
              <img src={asset("/icons/co-truck-small.svg")} alt="" width={14} height={14} />
              Troca grátis 30 dias
            </span>
          </div>
          <p className="co-sign">checkout-vtex · Versão Quick em Next.js</p>
        </aside>
      </main>
    </>
  );
}
