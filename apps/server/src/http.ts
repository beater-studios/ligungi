import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { ERROR_MESSAGES, type ErrorCode } from '@ligungi/protocol';
import type { Session } from './auth.ts';
import type { TrustProxy } from './config.ts';
import type { Player } from './games.ts';

export interface Context {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly session: Session;
  readonly player: Player;
  readonly ip: string;
  body(): Promise<unknown>;
  setSession(session: Session): void;
}

export type Handler = (ctx: Context) => void | Promise<void>;

interface Route {
  readonly method: string;
  readonly pattern: RegExp;
  readonly keys: string[];
  readonly handler: Handler;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.status = status;
    this.code = code;
  }
}

export const sendError = (res: ServerResponse, status: number, code: ErrorCode): void =>
  sendJson(res, status, { error: ERROR_MESSAGES[code], code });

/** `decodeURIComponent` that returns null on malformed input instead of throwing. */
export const safeDecode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export class Router {
  readonly #routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.#routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler });
    return this;
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | undefined {
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const found = route.pattern.exec(pathname);
      if (!found) continue;
      const params: Record<string, string> = {};
      for (const [i, key] of route.keys.entries()) {
        const value = safeDecode(found[i + 1]!);
        if (value === null) return undefined;
        params[key] = value;
      }
      return { handler: route.handler, params };
    }
    return undefined;
  }
}

export const sendJson = (res: ServerResponse, status: number, data: unknown): void => {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};

export const sendText = (res: ServerResponse, status: number, text: string, type = 'text/plain'): void => {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
  res.end(text);
};

const BODY_LIMIT = 64 * 1024;

export const readJson = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new HttpError(413, 'requestTooLarge'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'invalidJson'));
      }
    });
    req.on('error', reject);
  });

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serves the built web app, falling back to index.html for client-side routes. */
export const serveStatic = (root: string, pathname: string, res: ServerResponse, headOnly = false): boolean => {
  const base = resolve(root);
  const decoded = safeDecode(pathname);
  if (decoded === null || decoded.includes('\0')) return false;
  const candidate = resolve(join(base, normalize(decoded)));
  if (candidate !== base && !candidate.startsWith(base + sep)) return false;
  let file = candidate;
  let stats = safeStat(file);
  if (!stats?.isFile()) {
    if (extname(pathname)) return false;
    file = join(base, 'index.html');
    stats = safeStat(file);
    if (!stats?.isFile()) return false;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': stats.size,
    'cache-control': cacheControl(pathname, file),
  });
  if (headOnly) res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  return true;
};

/**
 * Build output under /assets/ has content-hashed names, so it can be cached for a year. The HTML must always be
 * revalidated so a deploy shows up at once. Anything else keeps a fixed name (the favicon), so it gets a week.
 */
const cacheControl = (pathname: string, file: string): string => {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  // no-transform: CDNs must not rewrite the page (Cloudflare would inject its analytics beacon before consent).
  if (extname(file) === '.html') return 'no-cache, no-transform';
  return 'public, max-age=604800, stale-while-revalidate=2592000';
};

const safeStat = (path: string) => {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
};

/** Client IP according to the configured proxy trust (see `TrustProxy`). */
export const clientIp = (req: IncomingMessage, trust: TrustProxy): string => {
  const direct = req.socket.remoteAddress ?? '';
  const header = (name: string) => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value.join(',') : value)?.trim() || null;
  };
  if (trust === 'cloudflare') return header('cf-connecting-ip') ?? direct;
  if (trust === 'proxy') return header('x-forwarded-for')?.split(',').at(-1)?.trim() || direct;
  return direct;
};

/** Fixed-window counter per key. Expired windows are dropped so memory stays bounded. */
export class RateLimiter {
  readonly #hits = new Map<string, { count: number; reset: number }>();
  #nextSweep = 0;

  readonly limit: number;
  readonly windowMs: number;
  readonly now: () => number;

  constructor(limit: number, windowMs: number, now: () => number) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  allow(key: string): boolean {
    const now = this.now();
    this.#sweep(now);
    const entry = this.#hits.get(key);
    if (!entry || entry.reset <= now) {
      this.#hits.set(key, { count: 1, reset: now + this.windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= this.limit;
  }

  /** Whether the key is over the limit, without counting a new hit. */
  blocked(key: string): boolean {
    const entry = this.#hits.get(key);
    return Boolean(entry && entry.reset > this.now() && entry.count >= this.limit);
  }

  get size(): number {
    return this.#hits.size;
  }

  #sweep(now: number): void {
    if (now < this.#nextSweep) return;
    this.#nextSweep = now + this.windowMs;
    for (const [key, entry] of this.#hits) if (entry.reset <= now) this.#hits.delete(key);
  }
}
