# Maré Moda Praia · checkout (Beta)

Repo gerado pelo painel da Quick a partir do template `checkout-vtex` v0.1.0
em 2026-10-22. Este arquivo é para quem programa aqui — gente ou IA. Leia antes de mudar
qualquer coisa.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript estrito.
- **Versão Quick (headless):** checkout em uma página (contato → entrega → pagamento) e confirmação, layout do Figma "Maré" (D5/D6). Servido pela loja em `/checkout` (multi-zones; `basePath` em `next.config.ts`).
- CSS puro com os tokens de `design/tokens.json` (mesmos valores em `app/globals.css`).
- Yarn 4 (`nodeLinker: node-modules`), Node 24. Testes com Vitest; lint com ESLint.

## A regra de ouro

**Nenhuma página fala com a VTEX direto.** Tudo passa pelo Commerce Adapter (`lib/commerce/`,
instância pronta em `lib/store.ts`). Assim o mesmo front funciona em qualquer plataforma que tenha
adaptador. Não importe URLs da VTEX em `app/` nem em `components/`.

## O contrato do Commerce Adapter

| Grupo | Métodos | Nesta loja |
|---|---|---|
| `catalog` | `getProducts(query)`, `getProduct(idOrSlug)`, `getCategories()` | VTEX Search/Catalog (rotas públicas) |
| `search` | `search(query)`, `suggest(term)` | busca por texto, categoria e ordem |
| `cart` | `create()`, `get(id)`, `addItem(id, item)`, `updateItem(id, itemId, qty)`, `estimateShipping(id, cep)` | orderForm da VTEX |
| `checkout` | `getCheckoutUrl(cartId)` | redirect para o checkout nativo (`/checkout/cart/add`) |
| `checkout` | `placeOrder`, `sendPayment` | **fora do escopo**: lançam `NotImplementedError` |
| `orders`, `customers`, `webhooks` | — | **fora do escopo** |

Dinheiro é sempre `{ amountCents, currency }` (centavos inteiros). Use `formatMoney` de `lib/format.ts`.

## capabilities() desta loja (quickdigitalpartnerbr · VTEX)

O que cada camada pode ser nesta plataforma. O painel só oferece o que está aqui.

| Camada | Origens possíveis | Validado | Observação |
|---|---|---|---|
| Web | nativo, versão Quick | sim |  |
| Checkout | nativo, carrinho Quick + redirect, versão Quick | sim | Checkout API completa. O pagamento precisa ser enviado até 5 min após criar o pedido. |
| App nativo | versão Quick | sim |  |
| SEO | nativo, versão Quick | sim |  |
| Busca | nativo, versão Quick | sim |  |
| Conteúdo | nativo, versão Quick | sim |  |
| E-mails | nativo, versão Quick | sim |  |

## Convenções

- Páginas e dados no servidor; `"use client"` só quando precisar de estado no navegador.
- Mutação = Server Action em `app/actions.ts`. O carrinho vive num cookie httpOnly (`qs_cart`).
- Imports com extensão `.ts`/`.tsx` (o mesmo código roda no Next e no Node do servidor MCP).
- Texto da interface em pt-BR. Sem segredos no repo: `.env.example` nunca tem valores.

## Comandos

```bash
yarn install
yarn dev          # http://localhost:3000
yarn typecheck && yarn lint && yarn test && yarn build   # o mesmo que a CI exige para o merge
```

## IA Gateway

- `.ai/skills/`: receitas passo a passo para esta camada.
- `.ai/mcp.json`: servidor MCP **somente leitura** (`yarn mcp`) com catálogo de teste, tokens de design e
  as versões desta loja no painel. Não tem acesso a credenciais da VTEX.
- A IA trabalha em branch; a CI bloqueia o merge sem typecheck, lint, testes e build; um dev aprova o PR.

## Checkout headless (Versão Quick)

- `lib/checkout/vtex.ts` é a extensão desta camada: orderForm → `clientProfileData` → `shippingData` (endereço + SLA) → `paymentData`
  → `transaction` → pagamento em `vtexpayments` (dentro dos 5 min) → `gatewayCallback` → `order-group`. Só rotas públicas, sem App Key.
- O carrinho é o mesmo `qs_cart` da camada Web. A loja entrega o carrinho em `/checkout/sacola/{orderFormId}`.
- Pix e Boleto rodam inteiros no servidor (não há dado de cartão). Cartão fica para quando houver adquirente: dado de cartão
  nunca passa por este servidor; ele vai do navegador direto para o gateway.
- Conta de teste `quickdigitalpartnerbr`: afiliação "TestPay (demo Maré)" (conector de teste da VTEX) com Pix, Boleto, Visa e Mastercard.
  A conta está marcada como "em produção", e nesse modo o TestPay nega a autorização. Por isso existe o **modo demonstração**
  (`CHECKOUT_DEMO_PAYMENT_SYSTEM`, padrão `17` = Promissória): o pedido é criado na VTEX com pagamento pendente, sem cobrança, e a tela avisa.
  Com um gateway real de Pix/Boleto configurado, defina `CHECKOUT_DEMO_PAYMENT_SYSTEM=""` na Vercel.
- Promoções na conta: 5% no Pix (e na Promissória do modo demo) e frete grátis acima de R$ 299.
- Links para a loja usam `<a href="/">` (fora do basePath). Arquivos de `public/` precisam de `asset()` (`lib/paths.ts`).
