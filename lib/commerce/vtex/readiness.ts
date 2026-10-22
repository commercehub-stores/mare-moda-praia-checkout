// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
import { totalFromResources, type VtexHost, VtexHttp, VtexHttpError } from "./http.ts";

export type CheckResult = "PASS" | "WARN" | "FAIL";

export interface ReadinessItem {
  key: "app_key" | "catalog" | "logistics" | "payment" | "order_feed";
  label: string;
  result: CheckResult;
  /** pt-BR, for the person setting up the store. */
  message: string;
}

export type EventState = "ACTIVE" | "NOT_CONFIGURED" | "UNKNOWN";

export interface PlatformEventItem {
  key: "product_changed" | "price_stock" | "order_created" | "order_canceled";
  label: string;
  source: string;
  action: string;
  state: EventState;
  detail: string;
}

export interface ConnectionResult {
  ok: boolean;
  latencyMs: number;
  /** pt-BR; null when ok. */
  error: string | null;
}

export interface VtexAdminOptions {
  account: string;
  credentials: { appKey: string; appToken: string };
  fetch?: typeof fetch;
  baseUrl?: (host: VtexHost, account: string) => string;
  salesChannel?: number;
}

const AREAS = [
  { name: "Catálogo", path: "/api/catalog_system/pvt/saleschannel/list", host: "store" },
  { name: "Logística", path: "/api/logistics/pvt/configuration/docks", host: "store" },
  { name: "Pedidos", path: "/api/oms/pvt/orders?per_page=1", host: "store" },
  { name: "Pagamentos", path: "/api/pvt/rules", host: "payments" },
] as const;

const SKU_PAGE = 1000;

interface Probe<T> {
  ok: boolean;
  status: number;
  data: T | null;
  headers: Headers | null;
}

/** Human text for a failed VTEX call, in pt-BR. */
export function describeVtexError(error: unknown): string {
  if (error instanceof VtexHttpError) {
    if (error.status === 401) return "App Key ou App Token inválidos";
    if (error.status === 403) return "A App Key não tem permissão para esta área";
    if (error.status === 0) return error.message;
    return `A VTEX respondeu ${error.status}`;
  }
  return error instanceof Error ? error.message : "Erro desconhecido";
}

/**
 * Read-only checks on a VTEX account with the store's App Key: connection, permissions and whether the
 * account is ready for a Quick storefront. Never writes to the account. A test account with no catalog,
 * logistics or payment set up gets WARN/FAIL with a message, never an exception.
 */
export class VtexAdmin {
  private readonly http: VtexHttp;
  private readonly sc: number;

  constructor(options: VtexAdminOptions) {
    this.http = new VtexHttp({ account: options.account, credentials: options.credentials, fetch: options.fetch, baseUrl: options.baseUrl });
    this.sc = options.salesChannel ?? 1;
  }

  private async probe<T>(path: string, host: VtexHost = "store", auth = true): Promise<Probe<T>> {
    try {
      const { data, headers, status } = await this.http.request<T>(path, { host, auth });
      return { ok: true, status, data, headers };
    } catch (error) {
      if (error instanceof VtexHttpError) return { ok: false, status: error.status, data: null, headers: null };
      throw error;
    }
  }

  /** "Testar agora": one authenticated read; 2xx means the key works. */
  async testConnection(): Promise<ConnectionResult> {
    const started = Date.now();
    try {
      await this.http.request("/api/catalog_system/pvt/saleschannel/list", { auth: true });
      return { ok: true, latencyMs: Date.now() - started, error: null };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: describeVtexError(error) };
    }
  }

  async readiness(): Promise<{ checks: ReadinessItem[]; events: PlatformEventItem[] }> {
    const [areas, salesChannels, skus, available, docks, warehouses, policies, rules, feed, hook] = await Promise.all([
      Promise.all(AREAS.map(async (area) => ({ area, probe: await this.probe(area.path, area.host) }))),
      this.probe<{ Id: number; Name: string; IsActive: boolean }[]>("/api/catalog_system/pvt/saleschannel/list"),
      this.probe<number[]>(`/api/catalog_system/pvt/sku/stockkeepingunitidsbysaleschannel?sc=${this.sc}&page=1&pageSize=${SKU_PAGE}&onlyAssigned=true`),
      this.probe<unknown[]>(`/api/catalog_system/pub/products/search?_from=0&_to=0&fq=isAvailablePerSalesChannel_${this.sc}:1&sc=${this.sc}`, "store", false),
      this.probe<{ id: string; name: string; isActive: boolean }[]>("/api/logistics/pvt/configuration/docks"),
      this.probe<{ id: string; name: string; isActive: boolean }[]>("/api/logistics/pvt/configuration/warehouses"),
      this.probe<{ items: { id: string; name: string; isActive: boolean }[] }>("/api/logistics/pvt/shipping-policies?page=1&perPage=100"),
      this.probe<{ id: string; name: string; enabled: boolean; paymentSystem?: { name?: string } }[]>("/api/pvt/rules", "payments"),
      this.probe<{ filter?: { type?: string; status?: string[]; expression?: string } }>("/api/orders/feed/config"),
      this.probe<{ filter?: { type?: string; status?: string[]; expression?: string }; hook?: { url?: string } }>("/api/orders/hook/config"),
    ]);

    const checks: ReadinessItem[] = [];

    // 1. Permissions: one read per area the storefront and the panel need.
    const denied = areas.filter((a) => !a.probe.ok);
    const unauthorized = areas.every((a) => a.probe.status === 401);
    checks.push(
      denied.length === 0
        ? { key: "app_key", label: "Permissões da App Key", result: "PASS", message: AREAS.map((a) => a.name).join(", ") }
        : unauthorized
          ? { key: "app_key", label: "Permissões da App Key", result: "FAIL", message: "App Key ou App Token inválidos" }
          : {
              key: "app_key",
              label: "Permissões da App Key",
              result: denied.length === AREAS.length ? "FAIL" : "WARN",
              message: `Sem acesso a: ${denied.map((a) => `${a.area.name}${a.probe.status ? ` (${a.probe.status})` : ""}`).join(", ")}`,
            },
    );

    // 2. Catalog: SKUs assigned to the sales channel, and how many products are actually sellable there.
    const channel = salesChannels.data?.find((c) => c.Id === this.sc);
    const skuCount = skus.data?.length ?? null;
    const sellable = available.ok ? (totalFromResources(available.headers?.get("resources") ?? null) ?? available.data?.length ?? 0) : null;
    if (!skus.ok) {
      checks.push({ key: "catalog", label: "Catálogo", result: "FAIL", message: `Não foi possível listar os SKUs da política comercial ${this.sc} (${skus.status || "sem resposta"})` });
    } else if (channel && !channel.IsActive) {
      checks.push({ key: "catalog", label: "Catálogo", result: "FAIL", message: `A política comercial ${this.sc} está inativa` });
    } else if (!skuCount) {
      checks.push({ key: "catalog", label: "Catálogo", result: "FAIL", message: `Nenhum SKU na política comercial ${this.sc}` });
    } else {
      const skuText = `${skuCount === SKU_PAGE ? `${SKU_PAGE}+` : skuCount} SKUs na política comercial ${this.sc}`;
      checks.push(
        sellable === 0
          ? { key: "catalog", label: "Catálogo", result: "WARN", message: `${skuText}, mas nenhum produto disponível (preço ou estoque)` }
          : { key: "catalog", label: "Catálogo", result: "PASS", message: sellable === null ? skuText : `${skuText} · ${sellable} produtos disponíveis` },
      );
    }

    // 3. Logistics: an active dock, warehouse and shipping policy.
    if (!docks.ok || !warehouses.ok || !policies.ok) {
      checks.push({ key: "logistics", label: "Logística", result: "FAIL", message: "Não foi possível ler a logística (verifique a permissão da App Key)" });
    } else {
      const missing = [
        !(docks.data ?? []).some((d) => d.isActive) && "doca",
        !(warehouses.data ?? []).some((w) => w.isActive) && "estoque",
        !(policies.data?.items ?? []).some((p) => p.isActive) && "política de envio",
      ].filter((m): m is string => Boolean(m));
      checks.push(
        missing.length === 0
          ? { key: "logistics", label: "Logística", result: "PASS", message: "Doca, estoque e política de envio ativos" }
          : { key: "logistics", label: "Logística", result: missing.length === 3 ? "FAIL" : "WARN", message: `Falta configurar: ${missing.join(", ")} (ativos)` },
      );
    }

    // 4. Payment: at least one enabled payment condition (rule).
    if (!rules.ok) {
      checks.push({ key: "payment", label: "Pagamento", result: "FAIL", message: "Não foi possível ler as condições de pagamento" });
    } else {
      const enabled = (rules.data ?? []).filter((r) => r.enabled);
      const names = [...new Set(enabled.map((r) => r.paymentSystem?.name).filter(Boolean))].slice(0, 3).join(", ");
      checks.push(
        enabled.length > 0
          ? { key: "payment", label: "Pagamento", result: "PASS", message: `${enabled.length} ${enabled.length === 1 ? "condição ativa" : "condições ativas"}${names ? ` (${names})` : ""}` }
          : { key: "payment", label: "Pagamento", result: "FAIL", message: "Nenhuma condição de pagamento ativa" },
      );
    }

    // 5. Order feed v3 (or hook), which the panel's order events need. Configured per App Key.
    const feedOn = feed.ok && Boolean(feed.data?.filter);
    const hookOn = hook.ok && Boolean(hook.data?.hook?.url);
    checks.push(
      feedOn || hookOn
        ? { key: "order_feed", label: "Feed de pedidos", result: "PASS", message: hookOn ? "Hook de pedidos configurado" : "Feed v3 configurado para esta App Key" }
        : feed.status === 403
          ? { key: "order_feed", label: "Feed de pedidos", result: "WARN", message: "A App Key não tem o papel Feed v3 and Hook" }
          : { key: "order_feed", label: "Feed de pedidos", result: "WARN", message: "Feed de pedidos não configurado para esta App Key" },
    );

    // Events: catalog ones can't be read through the API; order ones follow the feed/hook filter.
    const filter = (hookOn ? hook.data?.filter : feed.data?.filter) ?? null;
    const covers = (status: string) => {
      if (!filter) return false;
      if (filter.type === "FromWorkflow") return (filter.status ?? []).includes(status);
      if (filter.type === "FromOrders") return (filter.expression ?? "").includes(status);
      return true;
    };
    const orderEvent = (key: "order_created" | "order_canceled", label: string, status: string, action: string): PlatformEventItem => {
      const on = (feedOn || hookOn) && covers(status);
      return {
        key,
        label,
        source: hookOn ? "Hook de pedidos" : "Feed de pedidos v3",
        action,
        state: on ? "ACTIVE" : "NOT_CONFIGURED",
        detail: on ? `Filtro inclui "${status}"` : feedOn || hookOn ? `O filtro não inclui "${status}"` : "Feed/hook não configurado",
      };
    };
    const catalogEvent = (key: "product_changed" | "price_stock", label: string, action: string): PlatformEventItem => ({
      key,
      label,
      source: "Catalog broadcaster",
      action,
      state: "UNKNOWN",
      detail: "A VTEX não informa pela API se o Broadcaster está ligado para esta conta",
    });
    const events = [
      catalogEvent("product_changed", "Produto alterado", "Reindexa a Busca e revalida a página do produto"),
      catalogEvent("price_stock", "Preço / estoque", "Revalida vitrine e PDP"),
      orderEvent("order_created", "Pedido criado", "order-created", "Recuperação de carrinho e analytics"),
      orderEvent("order_canceled", "Pedido cancelado", "canceled", "Ajusta relatórios e e-mails"),
    ];
    return { checks, events };
  }
}
