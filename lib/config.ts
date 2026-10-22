import config from "../quick.config.json" with { type: "json" };

/** Written by the Quick panel when this repo was generated. Holds no secret. */
export interface QuickConfig {
  storeId: string;
  storeName: string;
  platform: "VTEX";
  account: string;
  salesChannel: number;
  /** Where the shopper finishes the purchase (VTEX native checkout). Defaults to {account}.myvtex.com. */
  checkoutHost: string | null;
  layerType: string;
  templateKey: string;
  templateVersion: string;
  capabilities: Record<string, { allowedOrigins: string[]; verified: boolean; note: string | null }>;
}

export function parseConfig(raw: unknown): QuickConfig {
  const c = raw as Partial<QuickConfig>;
  if (!c || typeof c.account !== "string" || !c.account) throw new Error("quick.config.json: account ausente");
  if (c.platform !== "VTEX") throw new Error("quick.config.json: este template é para VTEX");
  return { salesChannel: 1, checkoutHost: null, capabilities: {}, ...c } as QuickConfig;
}

export const quickConfig: QuickConfig = parseConfig(config);
