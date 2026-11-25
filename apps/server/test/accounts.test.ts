import { describe, expect, it } from 'vitest';
import { type GameView, type Me, type RankingView, type ModUserView, type ProfileDetails, type SessionView, type TwoFactorSetup, type TwoFactorView, type UserProfile } from '@ligungi/protocol';
import { base32Decode, hotp, TOTP_STEP_MS } from '../src/totp.ts';
import { Client, makeModerator, signup, startGame, useServer, type TestServer } from './helpers.ts';

const { start: startServer, client } = useServer();
let server: TestServer | undefined;

describe('accounts', () => {
  it('signs up, logs out and logs back in', async () => {
    server = await startServer();
    const c = client();
    await signup(c, 'Komugi');
    const me = (await c.request<Me>('GET', '/api/me')).data;
    expect(me.user?.name).toBe('Komugi');
    expect(me.puzzleRating).toEqual({ rating: 1500, provisional: true, games: 0 });
    expect((await c.request('POST', '/api/signup', { username: 'komugi', password: 'outrasenha' })).status).toBe(409);
    await c.request('POST', '/api/logout', {});
    expect((await c.request<Me>('GET', '/api/me')).data).toMatchObject({ user: null, puzzleRating: null });
    expect((await c.request('POST', '/api/login', { username: 'komugi', password: 'errada123' })).status).toBe(401);
    expect((await c.request('POST', '/api/login', { username: 'KOMUGI', password: 'segredo123' })).status).toBe(200);
  });

  it('rejects cross-site and non-JSON writes', async () => {
    server = await startServer();
    const res = await fetch(`${server.base}/api/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });
});

describe('account', () => {
  it('changes the password, signs other devices out and keeps the current one signed in', async () => {
    server = await startServer();
    const laptop = client();
    const phone = client();
    await signup(laptop, 'Kurapika');
    expect((await phone.request('POST', '/api/login', { username: 'kurapika', password: 'segredo123' })).status).toBe(200);
    expect((await laptop.request<{ code: string }>('POST', '/api/account/password', { current: 'wrong-one', next: 'chains1234' })).data.code).toBe('wrongPassword');
    expect((await laptop.request<{ code: string }>('POST', '/api/account/password', { current: 'segredo123', next: 'short' })).data.code).toBe('invalidPassword');
    expect((await laptop.request('POST', '/api/account/password', { current: 'segredo123', next: 'chains1234' })).status).toBe(200);
    expect((await laptop.request<Me>('GET', '/api/me')).data.user?.name).toBe('Kurapika');
    expect((await phone.request<Me>('GET', '/api/me')).data.user).toBeNull();
    const fresh = client();
    expect((await fresh.request('POST', '/api/login', { username: 'kurapika', password: 'segredo123' })).status).toBe(401);
    expect((await fresh.request('POST', '/api/login', { username: 'kurapika', password: 'chains1234' })).status).toBe(200);
  });

  it('deletes an account, keeping its finished games anonymous', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Pitou');
    await signup(b, 'Pouf');
    await a.request('POST', '/api/users/pouf/follow');
    await b.request('POST', '/api/users/pitou/follow');
    const { id } = await startGame(a, b);
    expect((await a.request<{ code: string }>('POST', '/api/account/delete', { password: 'segredo123' })).data.code).toBe('activeGame');
    a.send({ t: 'abort', game: id });
    await a.waitGame(id, (g) => g.status === 'aborted');
    expect((await a.request<{ code: string }>('POST', '/api/account/delete', { password: 'nope-nope' })).data.code).toBe('wrongPassword');
    expect((await a.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);

    expect((await a.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await b.request('GET', '/api/users/pitou')).status).toBe(404);
    expect((await b.request<UserProfile>('GET', '/api/users/pouf')).data).toMatchObject({ followers: 0, following: 0 });
    const game = (await b.request<GameView>('GET', `/api/games/${id}`)).data;
    expect(game.players.white).toMatchObject({ name: 'Anonymous', user: null });
    expect(game.players.black.user?.name).toBe('Pouf');
    expect((await client().request('POST', '/api/login', { username: 'pitou', password: 'segredo123' })).status).toBe(401);
    expect((await client().request('POST', '/api/signup', { username: 'Pitou', password: 'segredo123' })).status).toBe(200);
  });

  it('requires a signed-in user for account actions', async () => {
    server = await startServer();
    const anon = client();
    expect((await anon.request<{ code: string }>('POST', '/api/account/delete', { password: 'x' })).data.code).toBe('loginRequired');
    expect((await anon.request<{ code: string }>('POST', '/api/account/password', { current: 'x', next: 'yyyyyyyy' })).data.code).toBe('loginRequired');
  });
});

describe('sessions and data export', () => {
  it('lists the account sessions without their secrets and signs out one or all the others', async () => {
    server = await startServer();
    const laptop = client();
    const phone = client();
    const tablet = client();
    await signup(laptop, 'Biscuit');
    for (const device of [phone, tablet]) {
      expect((await device.request('POST', '/api/login', { username: 'biscuit', password: 'segredo123' })).status).toBe(200);
    }
    const list = (await laptop.request<SessionView[]>('GET', '/api/account/sessions')).data;
    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const secrets = [laptop, phone, tablet].map((c) => c.cookie.split('=')[1]);
    for (const session of list) {
      expect(session.id).toMatch(/^[0-9a-f]{16}$/);
      expect(secrets).not.toContain(session.id);
      expect(session.userAgent).toBeTruthy();
    }
    const other = list.find((s) => !s.current)!;
    const current = list.find((s) => s.current)!;
    expect((await laptop.request<{ code: string }>('DELETE', `/api/account/sessions/${current.id}`)).data.code).toBe('sessionNotFound');
    expect((await laptop.request('DELETE', `/api/account/sessions/${other.id}`)).status).toBe(200);
    expect((await laptop.request<SessionView[]>('GET', '/api/account/sessions')).data).toHaveLength(2);
    expect((await laptop.request<{ revoked: number }>('DELETE', '/api/account/sessions')).data.revoked).toBe(1);
    expect((await phone.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await tablet.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await laptop.request<Me>('GET', '/api/me')).data.user?.name).toBe('Biscuit');
    expect((await client().request<{ code: string }>('GET', '/api/account/sessions')).data.code).toBe('loginRequired');
    await laptop.request('POST', '/api/logout');
    const anonymous = server.app.db.prepare('select count(*) as n from sessions where user_id is null and user_agent is not null').get() as { n: number };
    expect(anonymous.n).toBe(0);
  });

  it('does not list sessions that expired but were not swept yet', async () => {
    let now = Date.now();
    server = await startServer({ now: () => now });
    const kept = client();
    const stale = client();
    await signup(kept, 'Morel');
    expect((await stale.request('POST', '/api/login', { username: 'morel', password: 'segredo123' })).status).toBe(200);
    const day = 86_400_000;
    for (let step = 0; step < 2; step++) {
      now += 200 * day;
      expect((await kept.request<Me>('GET', '/api/me')).data.user?.name).toBe('Morel');
    }
    expect((await kept.request<SessionView[]>('GET', '/api/account/sessions')).data).toHaveLength(1);
  });

  it('exports the account data as a download, without session secrets', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Knuckle');
    await signup(b, 'Shoot');
    await a.request('POST', '/api/users/shoot/follow');
    await b.request('POST', '/api/users/knuckle/follow');
    const { id } = await startGame(a, b);
    a.send({ t: 'abort', game: id });
    await a.waitGame(id, (g) => g.status === 'aborted');
    const res = await fetch(`${server.base}/api/account/export`, { headers: { cookie: a.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="ligungi-Knuckle.json"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    const data = JSON.parse(text) as {
      account: { username: string };
      settings: { challengePolicy: string; followPolicy: string };
      following: string[];
      followers: string[];
      notices: Array<{ kind: string; player: string | null; read: boolean }>;
      sessions: Array<{ current: boolean }>;
      games: Array<{ id: string; color: string; opponent: string; result: string }>;
      ratings: Record<string, unknown>;
    };
    expect(data.account.username).toBe('Knuckle');
    expect(data.settings).toEqual({ challengePolicy: 'everyone', followPolicy: 'everyone' });
    expect(data.following).toEqual(['Shoot']);
    expect(data.followers).toEqual(['Shoot']);
    expect(data.notices).toEqual([expect.objectContaining({ kind: 'follow', player: 'Shoot', read: false })]);
    expect(data.sessions).toEqual([expect.objectContaining({ current: true })]);
    expect(data.games).toEqual([expect.objectContaining({ id, opponent: 'Shoot', result: 'aborted' })]);
    expect(Object.keys(data.ratings)).toHaveLength(4);
    expect(text).not.toContain(a.cookie.split('=')[1]!);
    expect(text).not.toContain(b.cookie.split('=')[1]!);
    expect((await client().request<{ code: string }>('GET', '/api/account/export')).data.code).toBe('loginRequired');
  });
});

describe('profile details', () => {
  it('saves the bio, country and linked profiles, shows them on the profile and the ranking, and lets moderators clear them', async () => {
    server = await startServer();
    const a = client();
    const mod = client();
    await signup(a, 'Biscuit');
    await signup(mod, 'Netero');
    expect((await a.request<ProfileDetails>('GET', '/api/account/profile')).data).toEqual({ bio: '', country: null, links: {} });
    expect((await client().request('POST', '/api/account/profile', { bio: '', country: null, links: {} })).status).toBe(401);
    expect((await a.request('POST', '/api/account/profile', { bio: 'Oi', country: 'br', links: { youtube: 'https://evil.example/x' } })).data).toMatchObject({
      code: 'invalidProfileLink',
    });
    const saved = await a.request<ProfileDetails>('POST', '/api/account/profile', {
      bio: 'Treino todo dia.',
      country: 'br',
      links: { youtube: '@biscuit', lichess: 'lichess.org/@/Biscuit', instagram: '' },
    });
    expect(saved.data).toEqual({ bio: 'Treino todo dia.', country: 'br', links: { youtube: 'biscuit', lichess: 'Biscuit' } });
    expect((await client().request<UserProfile>('GET', '/api/users/biscuit')).data.details).toEqual(saved.data);
    const exported = (await a.request<{ profile: ProfileDetails }>('GET', '/api/account/export')).data;
    expect(exported.profile).toEqual(saved.data);

    // The ranking carries the country (rows come from rated games, so one is faked here).
    server.app.db.prepare("insert into ratings (user_id, mode, rating, deviation, volatility, games, played_at) select id, 'intro', 1600, 50, 0.06, 10, ? from users where username_key = 'biscuit'").run(Date.now());
    expect((await client().request<RankingView>('GET', '/api/ranking/intro')).data.rows[0]).toMatchObject({ user: { name: 'Biscuit' }, country: 'br' });

    expect(makeModerator(server!, 'netero').code).toBe(0);
    expect((await a.request('POST', '/api/mod/users/biscuit/clear-profile', { reason: 'x' })).data).toMatchObject({ code: 'notModerator' });
    expect((await mod.request('POST', '/api/mod/users/biscuit/clear-profile', { reason: 'Link impróprio' })).status).toBe(200);
    expect((await client().request<UserProfile>('GET', '/api/users/biscuit')).data.details).toEqual({ bio: '', country: 'br', links: {} });
    expect((await mod.request<ModUserView>('GET', '/api/mod/users/biscuit')).data.log[0]).toMatchObject({ action: 'clearProfile', details: 'Link impróprio' });
  });
});

describe('two-factor authentication', () => {
  it('turns on with a first code, then asks for a code at sign-in that works only once', async () => {
    let now = 1_700_000_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    await signup(a, 'Kurapika');
    const status = async () => (await a.request<TwoFactorView>('GET', '/api/account/two-factor')).data;
    expect(await status()).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    expect((await a.request('POST', '/api/account/two-factor/setup', { password: 'errada123' })).data).toMatchObject({ code: 'wrongPassword' });
    const setup = (await a.request<TwoFactorSetup>('POST', '/api/account/two-factor/setup', { password: 'segredo123' })).data;
    expect(setup.uri).toBe(`otpauth://totp/ligungi:Kurapika?secret=${setup.secret}&issuer=ligungi`);
    const code = (offset = 0) => hotp(base32Decode(setup.secret), Math.floor(now / TOTP_STEP_MS) + offset);

    // Not on until the app proves it has the secret.
    expect(await status()).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    expect((await a.request('POST', '/api/account/two-factor/enable', { code: code(5) })).data).toMatchObject({ code: 'wrongTwoFactorCode' });
    const enabled = await a.request<{ recoveryCodes: string[] }>('POST', '/api/account/two-factor/enable', { code: code() });
    expect(enabled.data.recoveryCodes).toHaveLength(10);
    expect(await status()).toEqual({ enabled: true, recoveryCodesLeft: 10 });
    expect((await a.request('POST', '/api/account/two-factor/setup', { password: 'segredo123' })).data).toMatchObject({ code: 'twoFactorEnabled' });

    const login = (c: Client, extra: object = {}) => c.request<{ user: { name: string } }>('POST', '/api/login', { username: 'kurapika', password: 'segredo123', ...extra });
    const b = client();
    expect((await login(b)).data).toMatchObject({ code: 'twoFactorRequired' });
    // The code that turned it on was used already.
    expect((await login(b, { code: code() })).data).toMatchObject({ code: 'wrongTwoFactorCode' });
    now += TOTP_STEP_MS;
    const fresh = code();
    expect((await login(b, { code: fresh })).data.user.name).toBe('Kurapika');
    expect((await login(client(), { code: fresh })).data).toMatchObject({ code: 'wrongTwoFactorCode' });

    // A minute later, past the limit of sign-in attempts per minute. A recovery code works once, typed in any case.
    now += 60_000;
    const [first, second] = enabled.data.recoveryCodes;
    expect((await login(client(), { code: first!.toUpperCase() })).status).toBe(200);
    expect((await login(client(), { code: first })).data).toMatchObject({ code: 'wrongTwoFactorCode' });
    expect(await status()).toEqual({ enabled: true, recoveryCodesLeft: 9 });

    const exported = (await a.request<{ twoFactor: object }>('GET', '/api/account/export')).data;
    expect(exported.twoFactor).toMatchObject({ enabled: true, recoveryCodesLeft: 9 });
    expect(JSON.stringify(exported)).not.toContain(setup.secret);

    // New recovery codes replace the old ones.
    now += 60_000;
    const renewed = await a.request<{ recoveryCodes: string[] }>('POST', '/api/account/two-factor/recovery', { code: code() });
    expect(renewed.data.recoveryCodes).toHaveLength(10);
    expect((await login(client(), { code: second })).data).toMatchObject({ code: 'wrongTwoFactorCode' });

    // Turning it off needs the password and a code.
    now += 60_000;
    expect((await a.request('POST', '/api/account/two-factor/disable', { password: 'errada123', code: code() })).data).toMatchObject({ code: 'wrongPassword' });
    expect((await a.request('POST', '/api/account/two-factor/disable', { password: 'segredo123', code: '000000' })).status).toBe(401);
    expect((await a.request('POST', '/api/account/two-factor/disable', { password: 'segredo123', code: code() })).status).toBe(200);
    expect(await status()).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    expect((await login(client())).status).toBe(200);
  });

  it('signs out the other devices when asked to, while turning it on', async () => {
    const now = 1_700_000_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    await signup(a, 'Neferpitou');
    const other = client();
    expect((await other.request('POST', '/api/login', { username: 'neferpitou', password: 'segredo123' })).status).toBe(200);
    const setup = (await a.request<TwoFactorSetup>('POST', '/api/account/two-factor/setup', { password: 'segredo123' })).data;
    const code = hotp(base32Decode(setup.secret), Math.floor(now / TOTP_STEP_MS));
    const enabled = await a.request<{ revoked: number }>('POST', '/api/account/two-factor/enable', { code, signOutOthers: true });
    expect(enabled.data.revoked).toBe(1);
    expect((await other.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await a.request<Me>('GET', '/api/me')).data.user).toMatchObject({ name: 'Neferpitou' });
  });

  it('deletes a setup that was cancelled or not confirmed within 30 minutes', async () => {
    let now = 1_700_000_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    await signup(a, 'Shoot');
    const rows = () => (server!.app.db.prepare('select count(*) as n from two_factor').get() as { n: number }).n;
    await a.request('POST', '/api/account/two-factor/setup', { password: 'segredo123' });
    expect(rows()).toBe(1);
    expect((await a.request('DELETE', '/api/account/two-factor/setup')).status).toBe(200);
    expect(rows()).toBe(0);

    const setup = (await a.request<TwoFactorSetup>('POST', '/api/account/two-factor/setup', { password: 'segredo123' })).data;
    now += 31 * 60_000;
    const late = hotp(base32Decode(setup.secret), Math.floor(now / TOTP_STEP_MS));
    expect((await a.request('POST', '/api/account/two-factor/enable', { code: late })).data).toMatchObject({ code: 'twoFactorNotSetUp' });
    expect(rows()).toBe(0);
  });

  it('leaves nothing behind when the account is deleted', async () => {
    let now = 1_700_000_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    await signup(a, 'Pakunoda');
    const setup = (await a.request<TwoFactorSetup>('POST', '/api/account/two-factor/setup', { password: 'segredo123' })).data;
    await a.request('POST', '/api/account/two-factor/enable', { code: hotp(base32Decode(setup.secret), Math.floor(now / TOTP_STEP_MS)) });
    expect((await a.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
    const count = (table: string) => (server!.app.db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;
    expect([count('two_factor'), count('recovery_codes')]).toEqual([0, 0]);
  });
});
