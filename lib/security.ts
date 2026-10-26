import type { Redis } from "ioredis";
import { headers } from "next/headers";

/**
 * Request-level protections shared by the store layers (Web and Checkout keep an identical copy):
 * client IP, rate limiting, Cloudflare Turnstile, CPF check digits and safe internal redirects.
 */

/** The visitor's IP as seen through Cloudflare / Vercel / nginx (first hop of X-Forwarded-For). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ---------- rate limiting ----------

interface Store {
  /** Adds one hit to the key's window and returns the hits in the current window. */
  hit(key: string, windowSec: number): Promise<number>;
}

/** Fixed-window counter in this process. On a single server it is exact; on serverless it is per instance. */
class MemoryStore implements Store {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  async hit(key: string, windowSec: number): Promise<number> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      if (this.buckets.size > 50_000) this.sweep(now);
      return 1;
    }
    bucket.count += 1;
    return bucket.count;
  }
  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

/** Shared counter across instances (production server: REDIS_URL). */
class RedisStore implements Store {
  private client: Promise<Redis>;
  constructor(url: string) {
    this.client = import("ioredis").then(({ Redis: Client }) => new Client(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }));
  }
  async hit(key: string, windowSec: number): Promise<number> {
    const redis = await this.client;
    const results = await redis.multi().incr(key).expire(key, windowSec, "NX").exec();
    return Number(results?.[0]?.[1] ?? 1);
  }
}

const globalStore = globalThis as unknown as { __qsRateStore?: Store };
function store(): Store {
  if (!globalStore.__qsRateStore) {
    const url = process.env.REDIS_URL;
    globalStore.__qsRateStore = url ? new RedisStore(url) : new MemoryStore();
  }
  return globalStore.__qsRateStore;
}

export interface Limit {
  /** Name of the protected action, e.g. "pay". */
  name: string;
  max: number;
  windowSec: number;
}

/**
 * True when the caller is over the limit for this action. Counted per IP; a Redis outage fails open
 * (the shopper is not blocked because the counter is down).
 */
export async function overLimit({ name, max, windowSec }: Limit, subject?: string): Promise<boolean> {
  const who = subject ?? (await clientIp());
  try {
    return (await store().hit(`qs:rl:${name}:${who}`, windowSec)) > max;
  } catch {
    return false;
  }
}

/** Limits per IP for the store layers. Generous for a person, tight for a script. */
export const LIMITS = {
  // Web
  cart: { name: "cart", max: 60, windowSec: 600 },
  quote: { name: "quote", max: 30, windowSec: 600 },
  subscribe: { name: "subscribe", max: 5, windowSec: 3600 },
  // Checkout
  contact: { name: "contact", max: 20, windowSec: 600 },
  address: { name: "address", max: 30, windowSec: 600 },
  cep: { name: "cep", max: 30, windowSec: 600 },
  sla: { name: "sla", max: 30, windowSec: 600 },
  pay: { name: "pay", max: 5, windowSec: 3600 },
  handoff: { name: "handoff", max: 30, windowSec: 600 },
} satisfies Record<string, Limit>;

// ---------- Cloudflare Turnstile ----------

/** Public widget key; when unset, Turnstile is off (homologation without a Cloudflare account). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Verifies the widget token server-side. Returns true when Turnstile is not configured. */
export async function verifyHuman(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, remoteip: await clientIp() });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare unreachable: the rate limit still applies; refusing every order would be worse.
    return true;
  }
}

// ---------- input validation ----------

/** Brazilian CPF with valid check digits (rejects 000.000.000-00 style repeats). */
export function isCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** An internal path to redirect to: "/x/y" only. Rejects "//host", "/\\host", schemes and control characters. */
export function safePath(raw: string, fallback = "/"): string {
  const path = raw.split(/[?#]/)[0] ?? "";
  return /^\/(?![/\\])[A-Za-z0-9\-._~/]*$/.test(path) ? path : fallback;
}
