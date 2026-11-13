import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Db } from './db.ts';
import { safeDecode } from './http.ts';
import { randomId } from './ids.ts';

const KEY_LENGTH = 32;

interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

/**
 * OWASP's scrypt option with the lowest memory use (N=2^14, r=8, p=5): 16 MiB per hash, so concurrent logins
 * stay cheap on a small server while the extra passes keep the work factor at the recommended level.
 */
export const SCRYPT_PARAMS: ScryptParams = { N: 2 ** 14, r: 8, p: 5 };
const MAX_PARAMS: ScryptParams = { N: 2 ** 17, r: 16, p: 16 };

const derive = (password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { ...params, maxmem: 256 * params.N * params.r }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

const formatParams = ({ N, r, p }: ScryptParams) => `${N}:${r}:${p}`;

/** Accepts `N:r:p` and the original format, which stored only N (r=8, p=1). */
const parseParams = (text: string | undefined): ScryptParams | null => {
  const [N, r = 8, p = 1] = (text ?? '').split(':').map(Number);
  const valid = (value: number | undefined, max: number): value is number =>
    value !== undefined && Number.isInteger(value) && value >= 1 && value <= max;
  if (!valid(N, MAX_PARAMS.N) || !valid(r, MAX_PARAMS.r) || !valid(p, MAX_PARAMS.p)) return null;
  return { N, r, p };
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT_PARAMS);
  return ['scrypt', formatParams(SCRYPT_PARAMS), salt.toString('base64'), key.toString('base64')].join('$');
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [scheme, paramsText, saltText, keyText] = stored.split('$');
  const params = parseParams(paramsText);
  if (scheme !== 'scrypt' || !params || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, 'base64');
  const actual = await derive(password, Buffer.from(saltText, 'base64'), params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

/** Whether a stored hash uses older parameters and should be replaced after a successful login. */
export const needsRehash = (stored: string): boolean => stored.split('$')[1] !== formatParams(SCRYPT_PARAMS);

/** Malformed values are skipped instead of throwing. */
export const parseCookies = (header: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const part of header?.split(';') ?? []) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const value = safeDecode(part.slice(index + 1).trim());
    if (value !== null) cookies[part.slice(0, index).trim()] = value;
  }
  return cookies;
};

export const SESSION_COOKIE = 'sid';
const DAY_MS = 86_400_000;
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
/** Server-side expiry by inactivity: anonymous sessions are cheap to lose, signed-in ones match the cookie. */
const ANONYMOUS_TTL_MS = 30 * DAY_MS;
const USER_TTL_MS = 365 * DAY_MS;

export const sessionCookie = (id: string, secure: boolean): string =>
  `${SESSION_COOKIE}=${id}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

export interface Session {
  readonly id: string;
  readonly userId: string | null;
}

/** A signed-in session as its owner sees it in the account page. */
export interface StoredSession {
  readonly id: string;
  readonly createdAt: number;
  readonly seenAt: number;
  readonly userAgent: string | null;
}

const USER_AGENT_MAX = 256;
const userAgentOf = (value: string | undefined): string | null => value?.slice(0, USER_AGENT_MAX) || null;

/** Public handle of a session: the id itself is the cookie secret and never leaves the server. */
export const sessionHandle = (id: string): string => createHash('sha256').update(id).digest('hex').slice(0, 16);

export class Sessions {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  get(id: string | undefined): Session | undefined {
    if (!id) return undefined;
    const row = this.#db.prepare('select id, user_id, seen_at from sessions where id = ?').get(id) as
      | { id: string; user_id: string | null; seen_at: number }
      | undefined;
    if (!row) return undefined;
    const now = this.#now();
    if (now - row.seen_at > (row.user_id ? USER_TTL_MS : ANONYMOUS_TTL_MS)) {
      this.#db.prepare('delete from sessions where id = ?').run(id);
      return undefined;
    }
    if (now - row.seen_at > DAY_MS) this.#db.prepare('update sessions set seen_at = ? where id = ?').run(now, id);
    return { id: row.id, userId: row.user_id };
  }

  /** Deletes sessions inactive for longer than their TTL. Returns how many were removed. */
  sweep(): number {
    const now = this.#now();
    const result = this.#db
      .prepare('delete from sessions where (user_id is null and seen_at < ?) or (user_id is not null and seen_at < ?)')
      .run(now - ANONYMOUS_TTL_MS, now - USER_TTL_MS);
    return Number(result.changes);
  }

  create(): Session {
    const id = randomId(24);
    const now = this.#now();
    this.#db.prepare('insert into sessions (id, user_id, created_at, seen_at) values (?, null, ?, ?)').run(id, now, now);
    return { id, userId: null };
  }

  /** The user's live sessions (expired ones may wait for the next sweep), most recently active first. */
  listForUser(userId: string): StoredSession[] {
    const rows = this.#db
      .prepare(
        'select id, created_at, seen_at, user_agent from sessions where user_id = ? and seen_at >= ? order by seen_at desc, created_at desc',
      )
      .all(userId, this.#now() - USER_TTL_MS) as Array<{ id: string; created_at: number; seen_at: number; user_agent: string | null }>;
    return rows.map((row) => ({ id: row.id, createdAt: row.created_at, seenAt: row.seen_at, userAgent: row.user_agent }));
  }

  /** Signs a user out everywhere except the given session. Returns the ids removed. */
  deleteOtherSessions(userId: string, keep: string): string[] {
    const removed = this.listForUser(userId).filter((session) => session.id !== keep).map((session) => session.id);
    this.#db.prepare('delete from sessions where user_id = ? and id != ?').run(userId, keep);
    return removed;
  }

  /** Removes one of the user's sessions by its public handle, never `keep`. Returns the id removed. */
  deleteByHandle(userId: string, handle: string, keep: string): string | null {
    const session = this.listForUser(userId).find((entry) => entry.id !== keep && sessionHandle(entry.id) === handle);
    if (!session) return null;
    this.#db.prepare('delete from sessions where id = ?').run(session.id);
    return session.id;
  }

  /** Logging in or out rotates the session id to prevent fixation. */
  /** The user agent is kept only for signed-in sessions, which list it on the account page. */
  rotate(previous: string, userId: string | null, userAgent?: string): Session {
    this.#db.prepare('delete from sessions where id = ?').run(previous);
    const id = randomId(24);
    const now = this.#now();
    this.#db
      .prepare('insert into sessions (id, user_id, created_at, seen_at, user_agent) values (?, ?, ?, ?, ?)')
      .run(id, userId, now, now, userId ? userAgentOf(userAgent) : null);
    return { id, userId };
  }
}
