// Vendored from the Quick panel (packages/commerce). Regenerate instead of editing.
// Minimal VTEX REST client: fetch only, no SDK. Endpoints and hosts are listed in DECISIONS.md §4.9.

/** Which VTEX host a request goes to. */
export type VtexHost = "store" | "payments";

export interface VtexHttpOptions {
  account: string;
  /** "vtexcommercestable" (default) is VTEX's stable environment for API calls. */
  environment?: string;
  /** App Key / App Token. Only sent on private routes; never logged, never part of an error. */
  credentials?: { appKey: string; appToken: string } | null;
  fetch?: typeof fetch;
  /** Tests and local mocks: replace each host's origin (no trailing slash). */
  baseUrl?: (host: VtexHost, account: string) => string;
  timeoutMs?: number;
}

/** A VTEX call that did not return 2xx. Carries the status and path, never headers or credentials. */
export class VtexHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "VtexHttpError";
  }
}

const ACCOUNT_NAME = /^[a-z0-9][a-z0-9-]{1,62}$/i;

export class VtexHttp {
  readonly account: string;
  readonly environment: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: VtexHttpOptions) {
    // The account goes into a hostname: refuse anything that is not a plain account name.
    if (!ACCOUNT_NAME.test(options.account)) throw new Error("Conta VTEX inválida");
    this.account = options.account.toLowerCase();
    this.environment = options.environment ?? "vtexcommercestable";
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  origin(host: VtexHost): string {
    if (this.options.baseUrl) return this.options.baseUrl(host, this.account);
    return host === "payments" ? `https://${this.account}.vtexpayments.com.br` : `https://${this.account}.${this.environment}.com.br`;
  }

  async request<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: unknown; host?: VtexHost; auth?: boolean } = {},
  ): Promise<{ data: T; headers: Headers; status: number }> {
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    if (init.auth) {
      const creds = this.options.credentials;
      if (!creds) throw new VtexHttpError(401, path, "Credencial da VTEX não informada");
      headers["X-VTEX-API-AppKey"] = creds.appKey;
      headers["X-VTEX-API-AppToken"] = creds.appToken;
    }
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.origin(init.host ?? "store")}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timeout = error instanceof Error && error.name === "TimeoutError";
      throw new VtexHttpError(0, path, timeout ? "A VTEX não respondeu a tempo" : "Não foi possível falar com a VTEX");
    }
    const text = await res.text();
    if (!res.ok) throw new VtexHttpError(res.status, path, `VTEX respondeu ${res.status} em ${path}`);
    let data: T;
    try {
      data = (text ? JSON.parse(text) : null) as T;
    } catch {
      throw new VtexHttpError(res.status, path, `Resposta inesperada da VTEX em ${path}`);
    }
    return { data, headers: res.headers, status: res.status };
  }
}

/** "0-9/19" → 19. Documented on the Search API (`resources` header). */
export function totalFromResources(value: string | null): number | null {
  const match = value?.match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}
