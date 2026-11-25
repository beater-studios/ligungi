import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DISCORD_TIERS, discordTier, type DiscordLinkResult, type DiscordLinkView, type DiscordTier } from '@ligungi/protocol';
import type { DiscordConfig } from './config.ts';
import type { Db } from './db.ts';
import { randomId } from './ids.ts';
import type { Users } from './users.ts';

const API = 'https://discord.com/api/v10';
const AUTHORIZE = 'https://discord.com/oauth2/authorize';
const SCOPES = 'identify role_connections.write';
const PLATFORM = 'ligungi';
const STATE_TTL_MS = 10 * 60_000;
const MAX_STATES = 1000;
/** A token this close to expiring is renewed before use. */
const REFRESH_MARGIN_MS = 60_000;
/** Discord's error code when the user is not a member of the server. */
const UNKNOWN_MEMBER = 10007;

/**
 * The fields of the Linked Roles connection, registered once with `node src/cli.ts discord metadata`. Types: 2 is
 * "at least" for a number, 5 is "at least this many days ago" for a date.
 */
export const DISCORD_METADATA = [
  { key: 'rating', name: 'Rating', description: 'Best established rating on ligungi, across the modes', type: 2 },
  { key: 'rated_games', name: 'Rated games', description: 'Rated games played on ligungi', type: 2 },
  { key: 'member_since', name: 'Days on ligungi', description: 'Days since the ligungi account was created', type: 5 },
] as const;

interface LinkRow {
  user_id: string;
  discord_id: string;
  discord_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  tier: string | null;
  metadata: string | null;
  paused: number;
  linked_at: number;
}

interface Tokens {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

class DiscordError extends Error {
  readonly status: number;
  readonly code: number | null;
  constructor(status: number, code: number | null) {
    super(`Discord answered ${status}${code === null ? '' : ` (code ${code})`}`);
    this.status = status;
    this.code = code;
  }
}

const unknownMember = (error: unknown): boolean => error instanceof DiscordError && error.status === 404 && error.code === UNKNOWN_MEMBER;

/** Tokens are stored encrypted (AES-256-GCM: iv, tag, ciphertext), so a leaked backup gives no access to Discord accounts. */
const seal = (key: Buffer, text: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
};

const unseal = (key: Buffer, sealed: string): string => {
  const raw = Buffer.from(sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
};

const logFailure = (what: string, error: unknown): void => {
  console.warn(`discord: ${what} failed: ${error instanceof Error ? error.message : String(error)}`);
};

/**
 * The link between a ligungi account and a Discord account: the OAuth sign-in, the Linked Roles connection (the
 * Verified player role and the connection on the Discord profile) and the rank role the bot gives from the rating.
 * Discord is only called when something changed, after the game is saved; a failure is logged and the next rated
 * game tries again. A player who left the Discord server is paused until they check again from their account.
 */
export class DiscordLinks {
  readonly #db: Db;
  readonly #users: Users;
  readonly #config: DiscordConfig | null;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #states = new Map<string, { readonly userId: string; readonly expiresAt: number }>();
  /** One sync per player at a time, so two games ending together never race on the same roles. */
  readonly #running = new Map<string, Promise<void>>();
  /** Clean-ups left running after a request answered (a deleted account, a replaced Discord account). */
  readonly #background = new Set<Promise<void>>();

  constructor(db: Db, users: Users, config: DiscordConfig | null, fetcher: typeof fetch, now: () => number) {
    this.#db = db;
    this.#users = users;
    this.#config = config;
    this.#fetch = fetcher;
    this.#now = now;
  }

  /** The application id, which is also the Activity's address (`<id>.discordsays.com`); null when not configured. */
  get clientId(): string | null {
    return this.#config?.clientId ?? null;
  }

  /**
   * Inside the Activity: who the player is on Discord and the ligungi account linked to them, from the code the
   * Embedded App SDK got. The access token goes back to the Activity, which needs it to authenticate the SDK.
   */
  async activitySignIn(code: string): Promise<{ discordId: string; userId: string | null; accessToken: string } | null> {
    try {
      const tokens = await this.#token({ grant_type: 'authorization_code', code });
      const me = (await this.#call('GET', '/users/@me', { bearer: tokens.access_token })) as { id: string };
      const owner = this.#db.prepare('select user_id from discord_links where discord_id = ?').get(me.id) as { user_id: string } | undefined;
      return { discordId: me.id, userId: owner?.user_id ?? null, accessToken: tokens.access_token };
    } catch (error) {
      logFailure('activity sign-in', error);
      return null;
    }
  }

  /** The Discord users in an Activity instance (none once it ended), or null when it cannot be checked (no bot). */
  async instanceUsers(instanceId: string): Promise<ReadonlySet<string> | null> {
    const config = this.#required();
    if (!config.bot) return null;
    try {
      const path = `/applications/${config.clientId}/activity-instances/${encodeURIComponent(instanceId)}`;
      const data = (await this.#call('GET', path, { bot: config.bot.token })) as { users?: unknown };
      return new Set(Array.isArray(data.users) ? data.users.filter((id): id is string => typeof id === 'string') : []);
    } catch (error) {
      if (error instanceof DiscordError && error.status === 404) return new Set();
      logFailure('activity instance', error);
      return null;
    }
  }

  get enabled(): boolean {
    return this.#config !== null;
  }

  view(userId: string): DiscordLinkView {
    const row = this.#config ? this.#row(userId) : undefined;
    return {
      enabled: this.enabled,
      link: row
        ? {
            discordName: row.discord_name,
            tier: DISCORD_TIERS.find((tier) => tier.id === row.tier)?.id ?? null,
            paused: row.paused === 1,
            linkedAt: row.linked_at,
          }
        : null,
    };
  }

  /** What the data export shows: never the tokens. */
  exportFor(userId: string): { discordId: string; discordName: string; linkedAt: string; paused: boolean } | null {
    const row = this.#row(userId);
    return row ? { discordId: row.discord_id, discordName: row.discord_name, linkedAt: new Date(row.linked_at).toISOString(), paused: row.paused === 1 } : null;
  }

  /** The Discord page that asks the player to authorize ligungi, with a single-use state tied to their account. */
  authorizeUrl(userId: string): string {
    const config = this.#required();
    const now = this.#now();
    for (const [key, pending] of this.#states) if (pending.expiresAt < now) this.#states.delete(key);
    while (this.#states.size >= MAX_STATES) this.#states.delete(this.#states.keys().next().value!);
    const state = randomId(24);
    this.#states.set(state, { userId, expiresAt: now + STATE_TTL_MS });
    const params = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: config.redirectUri, scope: SCOPES, state });
    return `${AUTHORIZE}?${params}`;
  }

  dropState(state: string): void {
    this.#states.delete(state);
  }

  /** Finishes the sign-in: checks the state, trades the code for tokens, stores the link and sends everything once. */
  async complete(userId: string, state: string, code: string): Promise<DiscordLinkResult> {
    const config = this.#required();
    const pending = this.#states.get(state);
    this.#states.delete(state);
    if (!pending || pending.userId !== userId || pending.expiresAt < this.#now()) return 'failed';
    let tokens: Tokens;
    let me: { id: string; username: string };
    try {
      tokens = await this.#token({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri });
      me = (await this.#call('GET', '/users/@me', { bearer: tokens.access_token })) as { id: string; username: string };
    } catch (error) {
      logFailure('sign-in', error);
      return 'failed';
    }
    const owner = this.#db.prepare('select user_id from discord_links where discord_id = ?').get(me.id) as { user_id: string } | undefined;
    if (owner && owner.user_id !== userId) {
      this.#inBackground(this.#revoke(tokens.refresh_token));
      return 'taken';
    }
    const previous = this.#row(userId);
    // A different Discord account replaces the old one, which loses the rank given to it.
    if (previous && previous.discord_id !== me.id) this.#inBackground(this.#cleanup(previous));
    this.#db
      .prepare(
        `insert into discord_links (user_id, discord_id, discord_name, access_token, refresh_token, expires_at, linked_at)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict (user_id) do update set discord_id = excluded.discord_id, discord_name = excluded.discord_name,
           access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at,
           tier = null, metadata = null, paused = 0, linked_at = excluded.linked_at, synced_at = null`,
      )
      .run(userId, me.id, me.username, seal(config.tokenKey, tokens.access_token), seal(config.tokenKey, tokens.refresh_token), this.#now() + tokens.expires_in * 1000, this.#now());
    await this.sync(userId, true).catch((error: unknown) => logFailure('first sync', error));
    return 'linked';
  }

  /** "Check again": a paused player who came back to the server gets their rank at once. */
  async check(userId: string): Promise<void> {
    const config = this.#required();
    const row = this.#row(userId);
    if (!row) return;
    if (row.paused && config.bot) {
      try {
        await this.#call('GET', `/guilds/${config.bot.guildId}/members/${row.discord_id}`, { bot: config.bot.token });
      } catch (error) {
        if (unknownMember(error)) return;
        throw error;
      }
    }
    this.#db.prepare('update discord_links set paused = 0 where user_id = ?').run(userId);
    await this.sync(userId, true);
  }

  /** Unlinks now and waits for Discord: the rank removed, the connection cleared, the grant revoked. */
  async unlink(userId: string): Promise<void> {
    const row = this.#row(userId);
    if (!row) return;
    this.#db.prepare('delete from discord_links where user_id = ?').run(userId);
    await this.#afterSync(userId, row);
  }

  /** For a deleted account: the link goes at once and Discord is cleaned up in the background. */
  forget(userId: string): void {
    const row = this.#row(userId);
    if (!row) return;
    this.#db.prepare('delete from discord_links where user_id = ?').run(userId);
    this.#inBackground(this.#afterSync(userId, row));
  }

  /** Cleans up once a sync already talking to Discord is done, so it cannot give a rank back after the clean-up. */
  async #afterSync(userId: string, row: LinkRow): Promise<void> {
    await this.#running.get(userId)?.catch(() => undefined);
    await this.#cleanup(row);
  }

  /** After a rated game (or a voided one) the players' ratings changed: their rank may have too. */
  ratingsChanged(userIds: readonly string[]): void {
    if (!this.#config) return;
    for (const userId of userIds) void this.sync(userId).catch((error: unknown) => logFailure('sync', error));
  }

  /** Sends what changed; `force` sends everything, as after linking. Queued behind any sync of the same player. */
  sync(userId: string, force = false): Promise<void> {
    const previous = this.#running.get(userId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.#syncNow(userId, force));
    this.#running.set(userId, next);
    void next
      .catch(() => undefined)
      .finally(() => {
        if (this.#running.get(userId) === next) this.#running.delete(userId);
      });
    return next;
  }

  /** Resolves when no sync or clean-up is running (closing the server, tests). */
  async idle(): Promise<void> {
    while (this.#running.size || this.#background.size) await Promise.allSettled([...this.#running.values(), ...this.#background]);
  }

  #inBackground(task: Promise<void>): void {
    const tracked = task.catch((error: unknown) => logFailure('clean-up', error)).finally(() => this.#background.delete(tracked));
    this.#background.add(tracked);
  }

  /** Registers the Linked Roles fields with Discord, with the bot token. */
  async registerMetadata(): Promise<void> {
    const config = this.#required();
    if (!config.bot) throw new Error('DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and the rank role ids are needed to register the fields');
    await this.#call('PUT', `/applications/${config.clientId}/role-connections/metadata`, { bot: config.bot.token, json: DISCORD_METADATA });
  }

  async #syncNow(userId: string, force: boolean): Promise<void> {
    const config = this.#config;
    const row = this.#row(userId);
    const user = this.#users.findById(userId);
    if (!config || !row || row.paused || !user) return;
    const ratings = this.#users.playedRatings([userId]).get(userId) ?? [];
    const established = ratings.filter((entry) => !entry.provisional).map((entry) => entry.rating);
    const best = established.length ? Math.max(...established) : null;
    const metadata = {
      rating: String(best ?? 0),
      rated_games: String(ratings.reduce((sum, entry) => sum + entry.games, 0)),
      member_since: new Date(user.createdAt).toISOString(),
    };
    const sent = JSON.stringify({ name: user.name, metadata });
    if (force || sent !== row.metadata) {
      const token = await this.#accessToken(row, config);
      if (token === null) return;
      await this.#call('PUT', `/users/@me/applications/${config.clientId}/role-connection`, {
        bearer: token,
        json: { platform_name: PLATFORM, platform_username: user.name, metadata },
      });
      this.#db.prepare('update discord_links set metadata = ? where user_id = ?').run(sent, userId);
    }
    const tier = discordTier(best);
    if (config.bot && (force || tier !== row.tier)) {
      const { token, guildId, tierRoles } = config.bot;
      const role = (id: DiscordTier) => `/guilds/${guildId}/members/${row.discord_id}/roles/${tierRoles[id]}`;
      try {
        for (const other of DISCORD_TIERS) {
          if (other.id !== tier && (force || other.id === row.tier)) await this.#call('DELETE', role(other.id), { bot: token });
        }
        if (tier) await this.#call('PUT', role(tier), { bot: token });
        this.#db.prepare('update discord_links set tier = ? where user_id = ?').run(tier, userId);
      } catch (error) {
        if (!unknownMember(error)) throw error;
        this.#db.prepare('update discord_links set paused = 1, tier = null where user_id = ?').run(userId);
      }
    }
    this.#db.prepare('update discord_links set synced_at = ? where user_id = ?').run(this.#now(), userId);
  }

  /** A usable access token, renewed when it is about to expire; null when the player revoked ligungi on Discord. */
  async #accessToken(row: LinkRow, config: DiscordConfig): Promise<string | null> {
    if (row.expires_at - REFRESH_MARGIN_MS > this.#now()) return unseal(config.tokenKey, row.access_token);
    let tokens: Tokens;
    try {
      tokens = await this.#token({ grant_type: 'refresh_token', refresh_token: unseal(config.tokenKey, row.refresh_token) });
    } catch (error) {
      if (error instanceof DiscordError && (error.status === 400 || error.status === 401)) {
        this.#db.prepare('delete from discord_links where user_id = ?').run(row.user_id);
        await this.#removeRanks(row.discord_id);
        return null;
      }
      throw error;
    }
    this.#db
      .prepare('update discord_links set access_token = ?, refresh_token = ?, expires_at = ? where user_id = ?')
      .run(seal(config.tokenKey, tokens.access_token), seal(config.tokenKey, tokens.refresh_token), this.#now() + tokens.expires_in * 1000, row.user_id);
    return tokens.access_token;
  }

  /** Best effort, step by step: a failure in one step does not stop the others. */
  async #cleanup(row: LinkRow): Promise<void> {
    const config = this.#config;
    if (!config) return;
    await this.#removeRanks(row.discord_id);
    try {
      if (row.expires_at - REFRESH_MARGIN_MS > this.#now()) {
        await this.#call('PUT', `/users/@me/applications/${config.clientId}/role-connection`, {
          bearer: unseal(config.tokenKey, row.access_token),
          json: { platform_name: PLATFORM, metadata: {} },
        });
      }
    } catch (error) {
      logFailure('clearing the connection', error);
    }
    await this.#revoke(unseal(config.tokenKey, row.refresh_token)).catch((error: unknown) => logFailure('revoke', error));
  }

  async #removeRanks(discordId: string): Promise<void> {
    const bot = this.#config?.bot;
    if (!bot) return;
    for (const tier of DISCORD_TIERS) {
      try {
        await this.#call('DELETE', `/guilds/${bot.guildId}/members/${discordId}/roles/${bot.tierRoles[tier.id]}`, { bot: bot.token });
      } catch (error) {
        if (unknownMember(error)) return;
        logFailure('removing a rank', error);
      }
    }
  }

  #token(fields: Record<string, string>): Promise<Tokens> {
    const config = this.#required();
    return this.#call('POST', '/oauth2/token', { form: { ...fields, client_id: config.clientId, client_secret: config.clientSecret } }) as Promise<Tokens>;
  }

  async #revoke(token: string): Promise<void> {
    const config = this.#required();
    await this.#call('POST', '/oauth2/token/revoke', {
      form: { token, token_type_hint: 'refresh_token', client_id: config.clientId, client_secret: config.clientSecret },
    });
  }

  async #call(
    method: string,
    path: string,
    options: { bearer?: string; bot?: string; json?: unknown; form?: Record<string, string> },
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;
    if (options.bot) headers.authorization = `Bot ${options.bot}`;
    let body: string | undefined;
    if (options.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    }
    const res = await this.#fetch(`${API}${path}`, { method, headers, ...(body === undefined ? {} : { body }), signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'number' ? data.code : null;
      throw new DiscordError(res.status, code);
    }
    return data;
  }

  #row(userId: string): LinkRow | undefined {
    return this.#db.prepare('select * from discord_links where user_id = ?').get(userId) as LinkRow | undefined;
  }

  #required(): DiscordConfig {
    if (!this.#config) throw new Error('the Discord link is not configured');
    return this.#config;
  }
}
