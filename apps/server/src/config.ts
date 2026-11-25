import { DISCORD_TIERS, type DiscordTier } from '@ligungi/protocol';

/**
 * Where the client IP comes from, for rate limiting:
 * - `none`: the TCP connection (the server faces the internet directly).
 * - `cloudflare`: the `CF-Connecting-IP` header. Only safe when the origin accepts traffic from Cloudflare alone
 *   (Cloudflare Tunnel or a firewall), otherwise anyone can forge the header.
 * - `proxy`: the last `X-Forwarded-For` entry, appended by a single trusted reverse proxy (nginx, Caddy).
 */
export type TrustProxy = 'none' | 'cloudflare' | 'proxy';

const TRUST_PROXY_VALUES: readonly TrustProxy[] = ['none', 'cloudflare', 'proxy'];

/** Ranks given by the bot, one Discord role id per tier (see `DISCORD_TIERS`). */
export interface DiscordBotConfig {
  readonly token: string;
  readonly guildId: string;
  readonly tierRoles: Readonly<Record<DiscordTier, string>>;
}

/** The Discord link (Linked Roles), on when the app's OAuth settings and the token key are set. */
export interface DiscordConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Where Discord sends the player back: `https://<site>/api/discord/callback`, registered in the app. */
  readonly redirectUri: string;
  /** 32 bytes that encrypt the stored tokens (AES-256-GCM). */
  readonly tokenKey: Buffer;
  /** Without it, players still get the Linked Roles connection but no rank roles. */
  readonly bot: DiscordBotConfig | null;
  /** Where the bot posts each new report for the moderators (`DISCORD_REPORTS_CHANNEL_ID`); off without it. */
  readonly reports?: { readonly token: string; readonly channelId: string } | null;
}

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
  readonly discord: DiscordConfig | null;
  /** How the server reaches Discord; tests replace it. */
  readonly fetch: typeof fetch;
}

const parseTrustProxy = (value: string | undefined): TrustProxy => {
  const mode = (value ?? 'none') as TrustProxy;
  if (!TRUST_PROXY_VALUES.includes(mode)) throw new Error(`TRUST_PROXY must be one of: ${TRUST_PROXY_VALUES.join(', ')}`);
  return mode;
};

const TIER_ENV: Readonly<Record<DiscordTier, string>> = {
  general: 'DISCORD_ROLE_GENERAL',
  lieutenantGeneral: 'DISCORD_ROLE_LIEUTENANT_GENERAL',
  majorGeneral: 'DISCORD_ROLE_MAJOR_GENERAL',
  samurai: 'DISCORD_ROLE_SAMURAI',
  soldier: 'DISCORD_ROLE_SOLDIER',
};

const parseDiscord = (env: NodeJS.ProcessEnv): DiscordConfig | null => {
  const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret, DISCORD_REDIRECT_URI: redirectUri, DISCORD_TOKEN_KEY: key } = env;
  if (!clientId || !clientSecret || !redirectUri || !key) return null;
  const tokenKey = Buffer.from(key, 'base64');
  if (tokenKey.length !== 32) throw new Error('DISCORD_TOKEN_KEY must be 32 bytes in base64 (openssl rand -base64 32)');
  const roles = Object.fromEntries(DISCORD_TIERS.map((tier) => [tier.id, env[TIER_ENV[tier.id]] ?? ''])) as Record<DiscordTier, string>;
  const { DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guildId } = env;
  const bot = token && guildId && Object.values(roles).every(Boolean) ? { token, guildId, tierRoles: roles } : null;
  const channelId = env.DISCORD_REPORTS_CHANNEL_ID;
  const reports = token && channelId ? { token, channelId } : null;
  return { clientId, clientSecret, redirectUri, tokenKey, bot, reports };
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
  discord: parseDiscord(env),
  fetch: (input, init) => fetch(input, init),
});
