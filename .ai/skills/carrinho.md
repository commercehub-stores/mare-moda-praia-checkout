# Carrinho

1. O carrinho é o orderForm da VTEX; o id fica no cookie `qs_cart` (`lib/cart.ts`).
2. Alterar/remover: `commerce.cart.updateItem(id, itemId, quantity)` (0 remove).
3. Tela em `app/carrinho/page.tsx`; mutações em `app/actions.ts`.
