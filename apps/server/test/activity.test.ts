import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

  it('lists the rooms of a call, opens and joins them, only for people in the call', async () => {
    server = await startServer({
      discord: config(),
      fetch: fakeDiscord({ a: 'd-a', b: 'd-b', c: 'd-c', d: 'd-d' }, { call: ['d-a', 'd-b', 'd-c'], other: ['d-d'] }),
    });
    const [a, b, c, d] = await Promise.all(
      ['a', 'b', 'c', 'd'].map(async (code) => {
        const client = new Client(server!.base);
        await activityRequest(client, 'POST', '/api/activity/session', { code });
        return client;
      }),
    );
    const rooms = async (client: Client, instanceId = 'call') => (await activityRequest(client, 'GET', `/api/activity/rooms?instanceId=${instanceId}`)).data;
    const open = (client: Client, body: Record<string, unknown> = {}) =>
      activityRequest(client, 'POST', '/api/activity/rooms', { instanceId: 'call', mode: 'intro', timeControl: { initial: 600, increment: 5 }, color: 'random', ...body });
    const join = (client: Client, id: unknown, instanceId = 'call') => activityRequest(client, 'POST', `/api/activity/rooms/${String(id)}/join`, { instanceId });

    expect(await rooms(a!)).toEqual({ rooms: [], games: [] });
    const first = (await open(a!)).data.challengeId;
    expect(first).toBeTruthy();
    // A new room replaces the one the player had open in this call.
    const second = (await open(a!, { mode: 'advanced', timeControl: { initial: 300, increment: 3 }, color: 'white' })).data.challengeId;
    const third = (await open(b!)).data.challengeId;
    const listed = (await rooms(c!)) as { rooms: Array<Record<string, unknown>> };
    expect(listed.rooms.map((room) => room.challengeId)).toEqual([second, third]);
    expect(listed.rooms[0]).toMatchObject({ settings: { mode: 'advanced', color: 'white', rated: false }, mine: false, challenger: { user: null } });
    expect(((await rooms(a!)) as typeof listed).rooms[0]).toMatchObject({ mine: true });
    expect(await rooms(d!, 'other')).toEqual({ rooms: [], games: [] });

    expect((await join(a!, first)).data).toMatchObject({ code: 'challengeUnavailable' });
    expect((await join(d!, second)).data).toMatchObject({ code: 'notInActivity' });
    expect((await join(d!, second, 'other')).data).toMatchObject({ code: 'challengeUnavailable' });
    const game = (await join(c!, second)).data.gameId;
    expect(game).toBeTruthy();
    const after = (await rooms(b!)) as { rooms: Array<Record<string, unknown>>; games: Array<Record<string, unknown>> };
    expect(after.rooms.map((room) => room.challengeId)).toEqual([third]);
    expect(after.games).toMatchObject([{ id: game, mode: 'advanced', status: 'started' }]);

    // Joining a room closes the joiner's own, so nobody is paired into two games at once.
    const fourth = (await open(a!)).data.challengeId;
    expect((await join(b!, fourth)).data.gameId).toBeTruthy();
    expect(((await rooms(c!)) as typeof after).rooms).toEqual([]);

    expect((await open(b!, { timeControl: { initial: 60, increment: 0 } })).data).toMatchObject({ code: 'invalidInitialTime' });
    expect((await open(b!, { rated: true })).data.challengeId).toBeTruthy();
    expect((await activityRequest(new Client(server.base), 'POST', '/api/activity/rooms', { instanceId: 'call' })).data).toMatchObject({ code: 'activitySignInRequired' });
    expect(await rooms(new Client(server.base))).toMatchObject({ code: 'activitySignInRequired' });
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
