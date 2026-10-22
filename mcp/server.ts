// Read-only MCP server for AI tools working on this repo (stdio). Run: yarn mcp
// Tools: catalog_search, catalog_product, catalog_categories, design_tokens, store_capabilities,
// store_versions. Nothing here writes anywhere, and no VTEX credential is ever read.
import { existsSync, readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { quickConfig } from "../lib/config.ts";
import { commerce } from "../lib/store.ts";

const root = new URL("../", import.meta.url);
if (existsSync(new URL(".env.local", root))) process.loadEnvFile(new URL(".env.local", root));

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

const server = new McpServer({ name: `quick-${quickConfig.account}`, version: quickConfig.templateVersion });

server.registerTool(
  "catalog_search",
  { title: "Buscar no catálogo", description: "Busca produtos da loja pelo Commerce Adapter (rotas públicas da VTEX).", inputSchema: { term: z.string(), limit: z.number().int().min(1).max(50).optional() } },
  async ({ term, limit }) => json(await commerce.search.search({ term, limit: limit ?? 10 })),
);

server.registerTool(
  "catalog_product",
  { title: "Produto", description: "Um produto por slug ou id, com variações e preços.", inputSchema: { idOrSlug: z.string() } },
  async ({ idOrSlug }) => json(await commerce.catalog.getProduct(idOrSlug)),
);

server.registerTool("catalog_categories", { title: "Categorias", description: "A árvore de categorias da loja.", inputSchema: {} }, async () =>
  json(await commerce.catalog.getCategories()),
);

server.registerTool("design_tokens", { title: "Tokens de design", description: "Cores, raios, fonte e espaçamentos (design/tokens.json).", inputSchema: {} }, () =>
  json(JSON.parse(readFileSync(new URL("design/tokens.json", root), "utf8"))),
);

server.registerTool(
  "store_capabilities",
  { title: "capabilities()", description: "O que cada camada pode ser nesta plataforma (nativo, redirect, versão Quick).", inputSchema: {} },
  () => json(quickConfig.capabilities),
);

server.registerTool(
  "store_versions",
  { title: "Versões da loja", description: "Histórico de versões das camadas desta loja no painel da Quick (somente leitura).", inputSchema: {} },
  async () => {
    const base = process.env.QUICK_PANEL_API_URL;
    const token = process.env.QUICK_PANEL_TOKEN;
    if (!base || !token) return json({ error: "Defina QUICK_PANEL_API_URL e QUICK_PANEL_TOKEN em .env.local (o painel gera esse arquivo)." });
    const res = await fetch(`${base.replace(/\/+$/, "")}/agent/stores/${quickConfig.storeId}/versions`, { headers: { authorization: `Bearer ${token}` } });
    return json(res.ok ? await res.json() : { error: `O painel respondeu ${res.status}` });
  },
);

await server.connect(new StdioServerTransport());
