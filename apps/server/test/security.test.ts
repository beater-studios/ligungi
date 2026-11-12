import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../src/auth.ts';
import { RateLimiter, clientIp } from '../src/http.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
const dirs: string[] = [];
afterEach(async () => {
  await server?.close();
  server = undefined;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const MALFORMED = '%E0%A4%A';

const raw = (path: string, headers: Record<string, string> = {}, method = 'GET', body?: string) =>
  fetch(server!.base + path, { method, headers, ...(body === undefined ? {} : { body }) });

const alive = async () => (await raw('/api/lobby')).status === 200;

const login = (headers: Record<string, string>, username: string, password: string) =>
  raw('/api/login', { 'content-type': 'application/json', ...headers }, 'POST', JSON.stringify({ username, password }));

const upgrade = (cookie: string) =>
  new Promise<number>((resolve, reject) => {
    const { hostname, port } = new URL(server!.base);
    const req = httpRequest({
      hostname,
      port,
      path: '/ws',
      headers: {
        cookie,
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': randomBytes(16).toString('base64'),
      },
    });
    req.on('response', (res: IncomingMessage) => resolve(res.statusCode ?? 0));
    req.on('upgrade', (res: IncomingMessage, socket) => {
      socket.destroy();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });

describe('malformed input', () => {
  it('answers instead of crashing on malformed percent-encoding in paths, params and cookies', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'ligungi-static-'));
    dirs.push(staticDir);
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html>');
    server = await startServer({ staticDir });

    expect((await raw(`/api/users/${MALFORMED}`)).status).toBe(404);
    expect((await raw(`/${MALFORMED}`)).status).toBe(404);
    expect((await raw(`/assets/${MALFORMED}.js`)).status).toBe(404);
    expect((await raw('/assets/a%00b.js')).status).toBe(404);
    expect((await raw('/%2e%2e/%2e%2e/etc/passwd')).status).toBe(200);
    const me = await raw('/api/me', { cookie: `sid=${MALFORMED}` });
    expect(me.status).toBe(200);
    expect(me.headers.get('set-cookie')).toMatch(/^sid=/);
    expect(await upgrade(`sid=${MALFORMED}`)).toBe(401);
    expect(await alive()).toBe(true);
  });
});

describe('client IP', () => {
  const req = (headers: Record<string, string>) =>
    ({ headers, socket: { remoteAddress: '203.0.113.9' } }) as unknown as IncomingMessage;
  const spoofed = { 'x-forwarded-for': '1.1.1.1, 198.51.100.7', 'cf-connecting-ip': '192.0.2.44' };

  it('ignores forwarding headers unless a proxy is trusted', () => {
    expect(clientIp(req(spoofed), 'none')).toBe('203.0.113.9');
    expect(clientIp(req(spoofed), 'cloudflare')).toBe('192.0.2.44');
    expect(clientIp(req({}), 'cloudflare')).toBe('203.0.113.9');
    expect(clientIp(req(spoofed), 'proxy')).toBe('198.51.100.7');
    expect(clientIp(req({}), 'proxy')).toBe('203.0.113.9');
  });

  it('does not let a forged X-Forwarded-For bypass the login limit', async () => {
    server = await startServer();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await login({ 'x-forwarded-for': `10.0.0.${i}` }, 'nobody', 'x')).status);
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('keys the limit on CF-Connecting-IP behind Cloudflare', async () => {
    server = await startServer({ trustProxy: 'cloudflare' });
    for (let i = 0; i < 10; i++) await login({ 'cf-connecting-ip': '192.0.2.1' }, 'nobody', 'x');
    expect((await login({ 'cf-connecting-ip': '192.0.2.1' }, 'nobody', 'x')).status).toBe(429);
    expect((await login({ 'cf-connecting-ip': '192.0.2.2' }, 'nobody', 'x')).status).toBe(401);
  });

  it('limits failed logins per username across IPs', async () => {
    server = await startServer({ trustProxy: 'proxy' });
    const owner = new Client(server.base);
    expect((await owner.request('POST', '/api/signup', { username: 'Target', password: 'correct-horse' })).status).toBe(200);
    for (let i = 0; i < 20; i++) {
      expect((await login({ 'x-forwarded-for': `10.1.0.${i}` }, 'target', 'wrong-guess')).status).toBe(401);
    }
    expect((await login({ 'x-forwarded-for': '10.1.1.1' }, 'TARGET', 'wrong-guess')).status).toBe(429);
    expect((await login({ 'x-forwarded-for': '10.1.1.2' }, 'target', 'correct-horse')).status).toBe(429);
    expect((await login({ 'x-forwarded-for': '10.1.1.3' }, 'other', 'x')).status).toBe(401);
  });

  it('drops expired rate limit windows', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    for (let i = 0; i < 50; i++) limiter.allow(`ip-${i}`);
    expect(limiter.size).toBe(50);
    now = 1500;
    limiter.allow('fresh');
    expect(limiter.size).toBe(1);
  });
});

describe('sessions', () => {
  const count = () => (server!.app.db.prepare('select count(*) as n from sessions').get() as { n: number }).n;

  it('only stores sessions for writes and the bootstrap request', async () => {
    server = await startServer();
    for (const path of ['/api/lobby', '/api/tv', '/api/leaderboard', '/api/users/nobody']) {
      expect((await raw(path)).headers.get('set-cookie')).toBeNull();
    }
    expect(count()).toBe(0);
    expect((await raw('/api/me')).headers.get('set-cookie')).toMatch(/^sid=/);
    expect((await raw('/api/logout', { 'content-type': 'application/json' }, 'POST', '{}')).headers.get('set-cookie')).toMatch(/^sid=/);
    expect(count()).toBe(2);
  });

  it('limits new sessions per IP', async () => {
    server = await startServer();
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await raw('/api/me')).status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(30);
    expect(statuses.slice(30)).toEqual([429, 429]);
  });

  it('expires inactive sessions: anonymous after 30 days, signed in after a year', async () => {
    let now = Date.UTC(2026, 0, 1);
    server = await startServer({ now: () => now });
    const anon = new Client(server.base);
    const user = new Client(server.base);
    await anon.request('GET', '/api/me');
    await user.request('POST', '/api/signup', { username: 'Sleeper', password: 'segredo123' });
    now += 31 * 86_400_000;
    expect((await anon.request<{ user: unknown }>('GET', '/api/me')).data.user).toBeNull();
    expect((await user.request<{ user: { name: string } }>('GET', '/api/me')).data.user?.name).toBe('Sleeper');
    now += 366 * 86_400_000;
    expect((await user.request<{ user: unknown }>('GET', '/api/me')).data.user).toBeNull();
  });
});

describe('passwords', () => {
  it('hashes with the current scrypt parameters and still verifies the original format', async () => {
    const hash = await hashPassword('segredo123');
    expect(hash).toMatch(/^scrypt\$16384:8:5\$/);
    expect(await verifyPassword('segredo123', hash)).toBe(true);
    expect(await verifyPassword('segredo124', hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);

    const salt = randomBytes(16);
    const legacy = `scrypt$16384$${salt.toString('base64')}$${scryptSync('segredo123', salt, 32, { N: 16384 }).toString('base64')}`;
    expect(await verifyPassword('segredo123', legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(true);
    expect(await verifyPassword('x', 'scrypt$999999999$c2FsdA==$a2V5')).toBe(false);
  });

  it('upgrades an old hash on the next successful login', async () => {
    server = await startServer();
    const c = new Client(server.base);
    await c.request('POST', '/api/signup', { username: 'Veteran', password: 'segredo123' });
    const salt = randomBytes(16);
    const legacy = `scrypt$16384$${salt.toString('base64')}$${scryptSync('segredo123', salt, 32, { N: 16384 }).toString('base64')}`;
    server.app.db.prepare('update users set password_hash = ? where username = ?').run(legacy, 'Veteran');
    expect((await c.request('POST', '/api/login', { username: 'veteran', password: 'segredo123' })).status).toBe(200);
    const stored = server.app.db.prepare('select password_hash from users where username = ?').get('Veteran') as { password_hash: string };
    expect(stored.password_hash).toMatch(/^scrypt\$16384:8:5\$/);
  });
});

describe('static files', () => {
  it('caches hashed assets for a year, revalidates the HTML and serves audio with its type', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'ligungi-static-'));
    dirs.push(staticDir);
    mkdirSync(join(staticDir, 'assets'));
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html>');
    writeFileSync(join(staticDir, 'favicon.svg'), '<svg/>');
    writeFileSync(join(staticDir, 'assets', 'Move-abc123.ogg'), 'x');
    writeFileSync(join(staticDir, 'assets', 'index-abc123.js'), 'x');
    server = await startServer({ staticDir });
    const head = async (path: string) => {
      const res = await raw(path);
      return [res.headers.get('cache-control'), res.headers.get('content-type')];
    };
    expect(await head('/assets/index-abc123.js')).toEqual(['public, max-age=31536000, immutable', 'text/javascript; charset=utf-8']);
    expect(await head('/assets/Move-abc123.ogg')).toEqual(['public, max-age=31536000, immutable', 'audio/ogg']);
    expect((await head('/'))[0]).toBe('no-cache');
    expect((await head('/ranking'))[0]).toBe('no-cache');
    expect((await head('/favicon.svg'))[0]).toBe('public, max-age=604800, stale-while-revalidate=2592000');
  });
});

describe('headers', () => {
  it('sends a CSP that only allows connections to the same origin', async () => {
    server = await startServer();
    const csp = (await raw('/')).headers.get('content-security-policy') ?? '';
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
