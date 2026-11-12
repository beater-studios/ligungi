/**
 * Where the client IP comes from, for rate limiting:
 * - `none`: the TCP connection (the server faces the internet directly).
 * - `cloudflare`: the `CF-Connecting-IP` header. Only safe when the origin accepts traffic from Cloudflare alone
 *   (Cloudflare Tunnel or a firewall), otherwise anyone can forge the header.
 * - `proxy`: the last `X-Forwarded-For` entry, appended by a single trusted reverse proxy (nginx, Caddy).
 */
export type TrustProxy = 'none' | 'cloudflare' | 'proxy';

const TRUST_PROXY_VALUES: readonly TrustProxy[] = ['none', 'cloudflare', 'proxy'];

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  /** SQLite file, or `:memory:`. */
  readonly databasePath: string;
  /** Built web app to serve, if any. */
  readonly staticDir: string | null;
  readonly secureCookies: boolean;
  /** Allow Cloudflare Web Analytics' beacon (injected by Cloudflare's edge) through the CSP. */
  readonly cloudflareWebAnalytics: boolean;
  readonly trustProxy: TrustProxy;
  /** A game is aborted if a player does not make their first move in time. */
  readonly abortAfterMs: number;
  /** A player may claim victory once the opponent has been away this long. */
  readonly claimAfterMs: number;
  readonly now: () => number;
}

const parseTrustProxy = (value: string | undefined): TrustProxy => {
  const mode = (value ?? 'none') as TrustProxy;
  if (!TRUST_PROXY_VALUES.includes(mode)) throw new Error(`TRUST_PROXY must be one of: ${TRUST_PROXY_VALUES.join(', ')}`);
  return mode;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => ({
  port: Number(env.PORT ?? 4000),
  host: env.HOST ?? '0.0.0.0',
  databasePath: env.DATABASE_PATH ?? 'data/ligungi.db',
  staticDir: env.STATIC_DIR ?? null,
  secureCookies: env.SECURE_COOKIES === 'true',
  cloudflareWebAnalytics: env.CLOUDFLARE_WEB_ANALYTICS === 'true',
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  abortAfterMs: Number(env.ABORT_AFTER_MS ?? 60_000),
  claimAfterMs: Number(env.CLAIM_AFTER_MS ?? 30_000),
  now: Date.now,
});
