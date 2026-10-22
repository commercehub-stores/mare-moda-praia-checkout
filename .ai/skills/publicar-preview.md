# Publicar um build de teste (preview)

1. Garanta a CI verde localmente: `yarn typecheck && yarn lint && yarn test && yarn build`.
2. No painel da Quick: Loja › Integrações › Recursos › **Build local**. O painel roda
   `yarn install && yarn build` neste repo e registra um Deploy de preview com o log.
3. Veja o resultado em **Deploys** (status e log). Se falhar, o fim do log mostra o erro.
4. Deploy em Vercel e criação do repo no GitHub entram quando as integrações forem conectadas.
