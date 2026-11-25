import { randomBytes } from 'node:crypto';
import type { ChallengeView, DiscordLinkView, GameView, Me } from '@ligungi/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiscordConfig } from '../src/config.ts';
import { DISCORD_METADATA } from '../src/discord.ts';
import { Client, firstMove, startServer, type TestServer } from './helpers.ts';

const ROLES = { general: 'r-gen', lieutenantGeneral: 'r-lt', majorGeneral: 'r-maj', samurai: 'r-sam', soldier: 'r-sol' } as const;

const discordConfig = (bot = true): DiscordConfig => ({
  clientId: 'app',
  clientSecret: 'secret',
  redirectUri: 'https://ligungi.test/api/discord/callback',
  tokenKey: randomBytes(32),
  bot: bot ? { token: 'bot-token', guildId: 'guild', tierRoles: ROLES } : null,
});

/** Discord as far as ligungi uses it: OAuth tokens, the current user, the Linked Roles connection and guild roles. */
class FakeDiscord {
  readonly calls: Array<{ method: string; path: string; body: unknown }> = [];
  /** Members of the guild and their roles, by Discord id. */
  readonly members = new Map<string, Set<string>>();
  readonly connections = new Map<string, unknown>();
  /** The Discord user each authorization code signs in. */
  readonly codes = new Map<string, { id: string; username: string }>();
  revoked = false;
  readonly #tokens = new Map<string, { id: string; username: string }>();
  #issued = 0;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/api/v10', '');
    const method = init?.method ?? 'GET';
    const raw = typeof init?.body === 'string' ? init.body : '';
    const headers = new Headers(init?.headers);
    const body = headers.get('content-type')?.includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    this.calls.push({ method, path, body });
    const json = (status: number, data: unknown) => new Response(data === null ? null : JSON.stringify(data), { status });
    const bearer = headers.get('authorization')?.replace('Bearer ', '') ?? '';
    if (path === '/oauth2/token') {
      const form = body as Record<string, string>;
      if (form.grant_type === 'authorization_code') {
        const user = this.codes.get(form.code!);
        if (!user) return json(400, { error: 'invalid_grant' });
        return json(200, this.#issue(user));
      }
      if (this.revoked) return json(400, { error: 'invalid_grant' });
      const user = [...this.#tokens.entries()].find(([token]) => token === `refresh-of-${form.refresh_token}`)?.[1];
      return json(200, this.#issue(user ?? { id: '?', username: '?' }));
    }
    if (path === '/oauth2/token/revoke') return json(200, {});
    if (path === '/users/@me') return json(200, this.#tokens.get(bearer));
    const connection = path.match(/^\/users\/@me\/applications\/app\/role-connection$/);
    if (connection) {
      this.connections.set(this.#tokens.get(bearer)!.id, body);
      return json(200, body);
    }
    if (path === '/applications/app/role-connections/metadata') return json(200, body);
    if (/^\/channels\/[^/]+\/messages$/.test(path)) return json(200, { id: 'm1' });
    const member = path.match(/^\/guilds\/guild\/members\/([^/]+)(?:\/roles\/([^/]+))?$/);
    if (member) {
      const roles = this.members.get(member[1]!);
      if (!roles) return json(404, { message: 'Unknown Member', code: 10007 });
      if (member[2] && method === 'PUT') roles.add(member[2]);
      if (member[2] && method === 'DELETE') roles.delete(member[2]);
      return member[2] ? json(204, null) : json(200, { roles: [...roles] });
    }
    return json(404, { message: 'Unknown route', code: 0 });
  };

  #issue(user: { id: string; username: string }) {
    const n = ++this.#issued;
    this.#tokens.set(`access-${n}`, user);
    this.#tokens.set(`refresh-of-refresh-${n}`, user);
    return { access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 604800, token_type: 'Bearer', scope: 'identify role_connections.write' };
  }

  count(predicate: (call: { method: string; path: string }) => boolean): number {
    return this.calls.filter(predicate).length;
  }
}

const casual = { mode: 'intro', rated: true, timeControl: { initial: 600, increment: 5 }, color: 'white' };

let server: TestServer | undefined;
const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server?.close();
  server = undefined;
});

const client = () => {
  const c = new Client(server!.base);
  clients.push(c);
  return c;
};

const signup = async (c: Client, username: string): Promise<string> => {
  expect((await c.request('POST', '/api/signup', { username, password: 'segredo123' })).status).toBe(200);
  return (await c.request<Me>('GET', '/api/me')).data.user!.id;
};

/** A browser navigation that stops at the redirect, so nothing ever reaches the real Discord. */
const visit = async (c: Client, path: string): Promise<string> => {
  const res = await fetch(c.base + path, { redirect: 'manual', headers: { cookie: c.cookie } });
  expect(res.status).toBe(302);
  return res.headers.get('location')!;
};

const link = async (c: Client, fake: FakeDiscord, discordId: string, username = 'discord-name'): Promise<string> => {
  const authorize = new URL(await visit(c, '/api/discord/link'));
  expect(authorize.origin + authorize.pathname).toBe('https://discord.com/oauth2/authorize');
  expect(authorize.searchParams.get('scope')).toBe('identify role_connections.write');
  const code = `code-${discordId}`;
  fake.codes.set(code, { id: discordId, username });
  const back = await visit(c, `/api/discord/callback?code=${code}&state=${authorize.searchParams.get('state')}`);
  await server!.app.discord.idle();
  return back;
};

const setRating = (userId: string, rating: number, deviation = 50) => {
  server!.app.db
    .prepare('insert into ratings (user_id, mode, rating, deviation, volatility, games) values (?, ?, ?, ?, 0.06, 20) on conflict (user_id, mode) do update set rating = excluded.rating, deviation = excluded.deviation')
    .run(userId, 'intro', rating, deviation);
};

/** Plays a rated game in which `loser` resigns after one move each. */
const ratedGame = async (winner: Client, loser: Client) => {
  const created = await winner.request<ChallengeView>('POST', '/api/challenges', casual);
  const accepted = await loser.request<{ gameId: string }>('POST', `/api/challenges/${created.data.id}/accept`);
  const id = accepted.data.gameId;
  for (const c of [winner, loser]) {
    if (!c.socket) await c.connect();
    c.send({ t: 'sub', topic: `game:${id}` });
  }
  let [view] = await Promise.all([winner.waitGame(id), loser.waitGame(id)]);
  const play = async (mover: Client, other: Client, current: GameView) => {
    mover.send({ t: 'move', game: id, move: firstMove(current), ply: current.moves.length });
    const next = current.moves.length + 1;
    const [updated] = await Promise.all([mover.waitGame(id, (g) => g.moves.length === next), other.waitGame(id, (g) => g.moves.length === next)]);
    return updated;
  };
  const white = view.players.white.name === (await winner.request<Me>('GET', '/api/me')).data.user!.name ? winner : loser;
  const black = white === winner ? loser : winner;
  view = await play(white, black, view);
  view = await play(black, white, view);
  loser.send({ t: 'resign', game: id });
  await winner.waitGame(id, (g) => g.status === 'ended');
  await server!.app.discord.idle();
};

describe('Discord link', () => {
  it('tells the moderators of each new report on Discord, without mentions or link previews', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: { ...discordConfig(), reports: { token: 'bot-token', channelId: 'mods' } }, fetch: fake.fetch });
    const reporter = new Client(server.base);
    await reporter.request('POST', '/api/signup', { username: 'Palm', password: 'segredo123' });
    const target = new Client(server.base);
    await target.request('POST', '/api/signup', { username: 'Kite_2', password: 'segredo123' });
    expect((await reporter.request('POST', '/api/reports', { username: 'Kite_2', reason: 'name', details: '@everyone look *here*' })).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const post = fake.calls.find((call) => call.method === 'POST' && call.path === '/channels/mods/messages');
    expect(post?.body).toMatchObject({ allowed_mentions: { parse: [] }, flags: 4 });
    const content = (post!.body as { content: string }).content;
    expect(content).toContain('**New report** · Offensive name or profile');
    expect(content).toContain('Kite\\_2, reported by Palm');
    expect(content).toContain('> @everyone look \\*here\\*');
    expect(content).toContain('<https://ligungi.test/@/Kite_2> · <https://ligungi.test/mod>');
  });

  it('is off without the Discord settings', async () => {
    server = await startServer();
    const a = client();
    await signup(a, 'Gon');
    expect((await a.request<DiscordLinkView>('GET', '/api/account/discord')).data).toEqual({ enabled: false, link: null });
    expect(await visit(a, '/api/discord/link')).toBe('/account?discord=disabled');
    expect((await a.request('POST', '/api/account/discord/check')).status).toBe(404);
  });

  it('sends a signed-out visitor to sign in first, then back to the link', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    expect(await visit(client(), '/api/discord/link')).toBe('/login?next=%2Fapi%2Fdiscord%2Flink');
  });

  it('links an account, sends the Linked Roles fields and gives the rank of the best established rating', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const id = await signup(a, 'Killua');
    setRating(id, 1700);
    fake.members.set('d-killua', new Set());
    expect(await link(a, fake, 'd-killua', 'killua_z')).toBe('/account?discord=linked');
    const view = (await a.request<DiscordLinkView>('GET', '/api/account/discord')).data;
    expect(view).toMatchObject({ enabled: true, link: { discordName: 'killua_z', tier: 'majorGeneral', paused: false } });
    expect(fake.connections.get('d-killua')).toMatchObject({ platform_name: 'ligungi', platform_username: 'Killua', metadata: { rating: '1700', rated_games: '20' } });
    expect([...fake.members.get('d-killua')!]).toEqual([ROLES.majorGeneral]);
    // The tokens are stored encrypted.
    const row = server.app.db.prepare('select access_token from discord_links').get() as { access_token: string };
    expect(row.access_token).not.toContain('access-');
  });

  it('gives no rank while every rating is provisional', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const id = await signup(a, 'Biscuit');
    setRating(id, 1900, 200);
    fake.members.set('d-biscuit', new Set());
    await link(a, fake, 'd-biscuit');
    expect((await a.request<DiscordLinkView>('GET', '/api/account/discord')).data.link?.tier).toBeNull();
    expect(fake.connections.get('d-biscuit')).toMatchObject({ metadata: { rating: '0' } });
    expect(fake.members.get('d-biscuit')!.size).toBe(0);
  });

  it('refuses a wrong or reused state and a Discord account linked to someone else', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const b = client();
    await signup(a, 'Leorio');
    await signup(b, 'Kurapika');
    fake.codes.set('code-x', { id: 'd-shared', username: 'shared' });
    expect(await visit(a, '/api/discord/callback?code=code-x&state=forged')).toBe('/account?discord=failed');
    const state = new URL(await visit(a, '/api/discord/link')).searchParams.get('state');
    expect(await visit(b, `/api/discord/callback?code=code-x&state=${state}`)).toBe('/account?discord=failed');
    expect(await link(a, fake, 'd-shared')).toBe('/account?discord=linked');
    expect(await visit(a, `/api/discord/callback?code=code-d-shared&state=${state}`)).toBe('/account?discord=failed');
    expect(await link(b, fake, 'd-shared')).toBe('/account?discord=taken');
    expect(await visit(a, '/api/discord/callback?error=access_denied&state=whatever')).toBe('/account?discord=denied');
  });

  it('moves the rank after a rated game only when the tier changes', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const b = client();
    const idA = await signup(a, 'Zushi');
    await signup(b, 'Wing');
    setRating(idA, 1799);
    fake.members.set('d-zushi', new Set());
    await link(a, fake, 'd-zushi');
    expect([...fake.members.get('d-zushi')!]).toEqual([ROLES.majorGeneral]);
    const roleCalls = () => fake.count((call) => call.path.includes('/roles/'));
    const before = roleCalls();
    await ratedGame(a, b);
    // A win from 1799 against a new player crosses 1800.
    expect([...fake.members.get('d-zushi')!]).toEqual([ROLES.lieutenantGeneral]);
    expect(roleCalls() - before).toBe(2);
    const after = roleCalls();
    setRating(idA, 1850);
    await ratedGame(a, b);
    expect(roleCalls()).toBe(after);
    expect([...fake.members.get('d-zushi')!]).toEqual([ROLES.lieutenantGeneral]);
  });

  it('pauses a player who left the server and resumes when they check again', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const b = client();
    const id = await signup(a, 'Netero');
    await signup(b, 'Zeno');
    setRating(id, 2050);
    await link(a, fake, 'd-netero');
    expect((await a.request<DiscordLinkView>('GET', '/api/account/discord')).data.link).toMatchObject({ paused: true, tier: null });
    const calls = fake.calls.length;
    await ratedGame(a, b);
    expect(fake.calls.length).toBe(calls);
    expect((await a.request<DiscordLinkView>('POST', '/api/account/discord/check')).data.link?.paused).toBe(true);
    fake.members.set('d-netero', new Set());
    const resumed = (await a.request<DiscordLinkView>('POST', '/api/account/discord/check')).data.link;
    expect(resumed).toMatchObject({ paused: false, tier: 'general' });
    expect([...fake.members.get('d-netero')!]).toEqual([ROLES.general]);
  });

  it('drops the link when the player revoked ligungi on Discord', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const b = client();
    const id = await signup(a, 'Hisoka');
    await signup(b, 'Illumi');
    setRating(id, 1600);
    fake.members.set('d-hisoka', new Set());
    await link(a, fake, 'd-hisoka');
    server.app.db.prepare('update discord_links set expires_at = 0').run();
    fake.revoked = true;
    setRating(id, 1700);
    await ratedGame(a, b);
    expect((await a.request<DiscordLinkView>('GET', '/api/account/discord')).data.link).toBeNull();
    expect(fake.members.get('d-hisoka')!.size).toBe(0);
  });

  it('unlinks, and deleting the account removes the link too', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    const a = client();
    const id = await signup(a, 'Pariston');
    setRating(id, 1550);
    fake.members.set('d-pariston', new Set());
    await link(a, fake, 'd-pariston');
    expect([...fake.members.get('d-pariston')!]).toEqual([ROLES.samurai]);
    expect((await a.request<DiscordLinkView>('DELETE', '/api/account/discord')).data.link).toBeNull();
    expect(fake.members.get('d-pariston')!.size).toBe(0);
    expect(fake.connections.get('d-pariston')).toEqual({ platform_name: 'ligungi', metadata: {} });
    expect(fake.count((call) => call.path === '/oauth2/token/revoke')).toBe(1);

    await link(a, fake, 'd-pariston');
    expect((await a.request('GET', '/api/account/export')).data).toMatchObject({ discord: { discordId: 'd-pariston', paused: false } });
    expect((await a.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
    await server.app.discord.idle();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.app.db.prepare('select count(*) as n from discord_links').get()).toEqual({ n: 0 });
    expect(fake.members.get('d-pariston')!.size).toBe(0);
  });

  it('waits for a sync still talking to Discord before unlinking, so no rank comes back', async () => {
    const fake = new FakeDiscord();
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let hold = false;
    const fetcher: typeof fetch = async (input, init) => {
      if (hold && init?.method === 'PUT' && String(input).endsWith(`/roles/${ROLES.majorGeneral}`)) await held;
      return fake.fetch(input, init);
    };
    server = await startServer({ discord: discordConfig(), fetch: fetcher });
    const a = client();
    const id = await signup(a, 'Kurapika');
    setRating(id, 1550);
    fake.members.set('d-kurapika', new Set());
    await link(a, fake, 'd-kurapika');
    hold = true;
    setRating(id, 1700);
    server.app.discord.ratingsChanged([id]);
    const unlinked = a.request('DELETE', '/api/account/discord');
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    expect((await unlinked).status).toBe(200);
    await server.app.discord.idle();
    expect(fake.members.get('d-kurapika')!.size).toBe(0);
  });

  it('links without ranks when the bot is not configured', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(false), fetch: fake.fetch });
    const a = client();
    const id = await signup(a, 'Ging');
    setRating(id, 1900);
    await link(a, fake, 'd-ging');
    expect(fake.count((call) => call.path.includes('/guilds/'))).toBe(0);
    expect(fake.connections.get('d-ging')).toMatchObject({ metadata: { rating: '1900' } });
  });

  it('registers the Linked Roles fields', async () => {
    const fake = new FakeDiscord();
    server = await startServer({ discord: discordConfig(), fetch: fake.fetch });
    await server.app.discord.registerMetadata();
    expect(fake.calls.at(-1)).toEqual({ method: 'PUT', path: '/applications/app/role-connections/metadata', body: DISCORD_METADATA });
  });
});
