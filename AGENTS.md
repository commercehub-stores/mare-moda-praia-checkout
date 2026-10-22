# Maré Moda Praia · checkout (Beta)

Repo gerado pelo painel da Quick a partir do template `checkout-vtex` v0.1.0
em 2026-10-22. Este arquivo é para quem programa aqui — gente ou IA. Leia antes de mudar
qualquer coisa.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript estrito.
- **Beta:** telas de esqueleto. Hoje o fluxo é carrinho Quick → redirect para o checkout nativo da VTEX.
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
