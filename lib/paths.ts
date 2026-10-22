/** Public files live under the zone's basePath; plain <img src> does not add it automatically. */
export const asset = (path: string) => `/checkout${path}`;

/** Cookie holding the buyer's VTEX checkout auth (Vtex_CHKO_Auth…) after an order, to show the confirmation. */
export const ORDER_AUTH_COOKIE = "qs_chko";

/** The storefront's home (absolute: on the checkout's own host, "/" would be the checkout itself). */
export const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "https://mare-moda-praia-web.vercel.app";
