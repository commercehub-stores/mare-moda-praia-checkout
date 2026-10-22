import { VtexAdapter } from "./commerce/index.ts";
import { quickConfig } from "./config.ts";

/**
 * The only way this app talks to the platform: the Commerce Adapter. Pages never call VTEX URLs directly,
 * so a new platform means a new adapter, not a new front.
 */
export const commerce = new VtexAdapter(
  { storeId: quickConfig.storeId, platformAccount: quickConfig.account, credentials: {} },
  { salesChannel: quickConfig.salesChannel, checkoutHost: quickConfig.checkoutHost ?? undefined },
);
