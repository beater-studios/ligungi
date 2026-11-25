import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiscordConfig } from '../src/config.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
const dirs: string[] = [];
afterEach(async () => {
  await server?.close();
  server = undefined;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ORIGIN = 'https://app.discordsays.com';

const config = (bot = true): DiscordConfig => ({
  clientId: 'app',
  clientSecret: 'secret',
  redirectUri: 'https://ligungi.test/api/discord/callback',
  tokenKey: randomBytes(32),
  bot: bot ? { token: 'bot-token', guildId: 'guild', tierRoles: { general: 'a', lieutenantGeneral: 'b', majorGeneral: 'c', samurai: 'd', soldier: 'e' } } : null,
});

/** Discord as far as the Activity uses it: the code exchange, the current user and who is in an instance. */
const fakeDiscord = (users: Record<string, string>, instances: Record<string, string[]>): typeof fetch => async (input, init) => {
  const path = new URL(String(input)).pathname.replace('/api/v10', '');
  const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
  if (path === '/oauth2/token') {
    const code = new URLSearchParams(typeof init?.body === 'string' ? init.body : '').get('code') ?? '';
    return users[code] ? json(200, { access_token: `token-${code}`, refresh_token: 'r', expires_in: 600, token_type: 'Bearer' }) : json(400, { error: 'invalid_grant' });
  }
  if (path === '/users/@me') {
    const code = new Headers(init?.headers).get('authorization')?.replace('Bearer token-', '') ?? '';
    return json(200, { id: users[code], username: `user-${code}` });
  }
  const instance = path.match(/^\/applications\/app\/activity-instances\/(.+)$/);
  if (instance) return instances[instance[1]!] ? json(200, { instance_id: instance[1], users: instances[instance[1]!] }) : json(404, { code: 10000 });
  return json(404, { code: 0 });
};

/** A client inside the Activity: requests come from Discord's proxy origin and are marked as the Activity's. */
const activityRequest = async (c: Client, method: string, path: string, body?: unknown) => {
  const res = await fetch(c.base + path, {
    method,
    headers: { origin: ORIGIN, 'x-ligungi-activity': '1', 'content-type': 'application/json', cookie: c.cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) c.cookie = setCookie.split(';')[0]!;
  return { status: res.status, data: (await res.json()) as Record<string, unknown>, setCookie };
};

describe('Discord Activity', () => {
  it('is off without the Discord settings', async () => {
    server = await startServer();
    expect((await new Client(server.base).request('GET', '/api/activity/config')).data).toMatchObject({ code: 'activityDisabled' });
  });

  it('signs in a linked account, and a guest otherwise, with a cookie for Discord’s iframe', async () => {
    server = await startServer({ discord: config(), fetch: fakeDiscord({ gon: 'd-gon', killua: 'd-killua' }, {}) });
    expect((await new Client(server.base).request('GET', '/api/activity/config')).data).toEqual({ clientId: 'app' });

    const owner = new Client(server.base);
    await owner.request('POST', '/api/signup', { username: 'Gon', password: 'segredo123' });
    const gonId = (await owner.request<{ user: { id: string } }>('GET', '/api/me')).data.user.id;
    server.app.db
      .prepare('insert into discord_links (user_id, discord_id, discord_name, access_token, refresh_token, expires_at, linked_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(gonId, 'd-gon', 'gon', 'x', 'x', 0, 0);

    const gon = new Client(server.base);
    const signed = await activityRequest(gon, 'POST', '/api/activity/session', { code: 'gon' });
    expect(signed.data).toMatchObject({ user: { name: 'Gon' }, reason: null, accessToken: 'token-gon' });
    expect(signed.setCookie).toContain('SameSite=None');
    expect(signed.setCookie).toContain('Partitioned');
    expect((await activityRequest(gon, 'GET', '/api/me')).data).toMatchObject({ user: { name: 'Gon' } });

    const killua = new Client(server.base);
    expect((await activityRequest(killua, 'POST', '/api/activity/session', { code: 'killua' })).data).toMatchObject({ user: null, reason: 'unlinked' });
    expect((await activityRequest(new Client(server.base), 'POST', '/api/activity/session', { code: 'nobody' })).data).toMatchObject({ code: 'activitySignInFailed' });
  });

  it('pairs the first two of a call and sends the rest to watch, only for people in the call', async () => {
    server = await startServer({
      discord: config(),
      fetch: fakeDiscord({ a: 'd-a', b: 'd-b', c: 'd-c', d: 'd-d' }, { call: ['d-a', 'd-b', 'd-c'] }),
    });
    const [a, b, c, d] = await Promise.all(
      ['a', 'b', 'c', 'd'].map(async (code) => {
        const client = new Client(server!.base);
        await activityRequest(client, 'POST', '/api/activity/session', { code });
        return client;
      }),
    );
    const play = (client: Client) => activityRequest(client, 'POST', '/api/activity/play', { instanceId: 'call', mode: 'intro' });

    const first = await play(a!);
    expect(first.data.challengeId).toBeTruthy();
    expect((await play(a!)).data).toEqual({ challengeId: first.data.challengeId });
    const second = await play(b!);
    expect(second.data.gameId).toBeTruthy();
    expect((await play(c!)).data).toEqual({ gameId: second.data.gameId });
    expect((await play(d!)).data).toMatchObject({ code: 'notInActivity' });
    expect((await activityRequest(new Client(server.base), 'POST', '/api/activity/play', { instanceId: 'call' })).data).toMatchObject({ code: 'activitySignInRequired' });
  });

  it('logs what the proxy sends when asked, without the cookie value or the full address', async () => {
    server = await startServer({ discord: config(), fetch: fakeDiscord({ gon: 'd-gon' }, {}), logActivityProbe: true });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await fetch(`${server.base}/api/me`, { headers: { 'cf-worker': 'discordsays.com', 'cf-connecting-ip': '2a06:98c0:3600::103', 'x-ligungi-activity': '1' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const lines = log.mock.calls.filter(([tag]) => tag === '[activity-probe]').map(([, line]) => JSON.parse(String(line)) as Record<string, unknown>);
    log.mockRestore();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ path: '/api/me', cfWorker: 'discordsays.com', cfConnectingIp: '2a06:98c0:3600:…', status: 200, sessionCookie: false });
    expect(String(lines[0]!.setCookie)).toMatch(/^sid=…; .*Partitioned/);
  });

  it('lets only Discord frame the Activity’s page, and nothing else', async () => {
    const staticDir = mkdtempSync(join(tmpdir(), 'ligungi-static-'));
    dirs.push(staticDir);
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html>');
    server = await startServer({ discord: config(), staticDir, fetch: fakeDiscord({}, {}) });
    const csp = async (path: string, headers: Record<string, string> = {}) => (await fetch(server!.base + path, { headers })).headers.get('content-security-policy') ?? '';
    expect(await csp('/')).toContain("frame-ancestors 'none'");
    expect(await csp('/?frame_id=f&instance_id=i')).toContain('frame-ancestors https://discord.com');
    expect(await csp('/computer', { 'sec-fetch-dest': 'iframe' })).toContain('frame-ancestors https://discord.com');
  });
});
