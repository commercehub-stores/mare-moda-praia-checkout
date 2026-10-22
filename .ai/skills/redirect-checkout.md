# Redirect para o checkout nativo

1. `commerce.checkout.getCheckoutUrl(cartId)` monta `https://<loja>/checkout/cart/add?sc=…&sku=…&qty=…&seller=…`
   (URL de carrinho documentada pela VTEX). O host vem de `checkoutHost` em `quick.config.json`.
2. O pagamento acontece na VTEX. `placeOrder`/`sendPayment` não existem neste adaptador (fora do escopo).
