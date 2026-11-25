import { describe, expect, it } from 'vitest';
import { type GameView, type Me, type ModUserView, type ReportView, type UserProfile } from '@ligungi/protocol';
import { Client, casual, makeModerator, play, signup, startGame, useServer, type TestServer } from './helpers.ts';

const { start: startServer, client } = useServer();
let server: TestServer | undefined;

describe('moderation', () => {
  const login = (c: Client, username: string) => c.request('POST', '/api/login', { username, password: 'segredo123' });

  it('takes reports from players, and only moderators read and close them', async () => {
    server = await startServer();
    const mod = client();
    const a = client();
    const b = client();
    await signup(mod, 'Netero');
    await signup(a, 'Kite');
    await signup(b, 'Genthru');
    expect(makeModerator(server!, 'netero')).toMatchObject({ code: 0, output: 'Netero is now a moderator' });
    expect((await mod.request<Me>('GET', '/api/me')).data.moderator).toBe(true);
    expect((await a.request<Me>('GET', '/api/me')).data.moderator).toBe(false);

    expect((await a.request('POST', '/api/reports', { username: 'kite', reason: 'other', details: '' })).data).toMatchObject({ code: 'cannotReportSelf' });
    expect((await a.request('POST', '/api/reports', { username: 'genthru', reason: 'nope', details: '' })).data).toMatchObject({ code: 'invalidReport' });
    expect((await a.request('POST', '/api/reports', { username: 'genthru', reason: 'name', details: 'x'.repeat(501) })).data).toMatchObject({ code: 'invalidReport' });
    expect((await a.request('POST', '/api/reports', { username: 'genthru', reason: 'name', details: 'Nome ofensivo' })).status).toBe(200);
    expect((await a.request('POST', '/api/reports', { username: 'genthru', reason: 'behavior', details: '' })).data).toMatchObject({ code: 'alreadyReported' });

    expect((await a.request('GET', '/api/mod/reports')).data).toMatchObject({ code: 'notModerator' });
    const [report] = (await mod.request<ReportView[]>('GET', '/api/mod/reports')).data;
    expect(report).toMatchObject({ reason: 'name', details: 'Nome ofensivo', status: 'open', reporter: { name: 'Kite' }, target: { name: 'Genthru' } });
    expect((await mod.request<ModUserView>('GET', '/api/mod/users/genthru')).data).toMatchObject({ openReports: 1, suspension: null, moderator: false });
    expect((await mod.request('POST', `/api/mod/reports/${report!.id}/close`, { resolution: ' ' })).data).toMatchObject({ code: 'reasonRequired' });
    expect((await mod.request('POST', `/api/mod/reports/${report!.id}/close`, { resolution: 'Nome trocado' })).status).toBe(200);
    expect((await mod.request<ReportView[]>('GET', '/api/mod/reports')).data).toEqual([]);
    expect((await mod.request<ReportView[]>('GET', '/api/mod/reports?status=closed')).data[0]).toMatchObject({ status: 'closed', resolution: 'Nome trocado', closedBy: 'Netero' });

    // Moderators are out of reach of other moderators, themselves included: only the server command changes them.
    expect((await mod.request('POST', '/api/mod/users/netero/suspend', { days: 1, reason: 'teste' })).data).toMatchObject({ code: 'cannotModerateModerator' });

    const exported = (await a.request<{ moderation: { reportsMade: unknown[] } }>('GET', '/api/account/export')).data;
    expect(exported.moderation.reportsMade).toEqual([expect.objectContaining({ player: 'Genthru', reason: 'name', status: 'closed' })]);
  });

  it('suspends a player: out at once, games in progress lost, sign-in refused with the end and the reason', async () => {
    let now = 1_700_000_000_000;
    server = await startServer({ now: () => now });
    const mod = client();
    const a = client();
    const b = client();
    await signup(mod, 'Zeno');
    await signup(a, 'Hisoka');
    await signup(b, 'Illumi');
    makeModerator(server!, 'zeno');
    let { id, view } = await startGame(a, b);
    view = await play(a, b, view);
    view = await play(b, a, view);

    expect((await mod.request('POST', '/api/mod/users/hisoka/suspend', { days: 2, reason: 'Trapaça' })).data).toMatchObject({ code: 'invalidSuspension' });
    expect((await mod.request('POST', '/api/mod/users/hisoka/suspend', { days: 7, reason: 'Trapaça' })).status).toBe(200);
    expect((await b.waitGame(id, (g) => g.status === 'ended')).outcome).toEqual({ winner: 'black', reason: 'abandon' });
    expect((await a.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await login(client(), 'hisoka')).data).toMatchObject({ code: 'accountSuspended', until: now + 7 * 86_400_000, reason: 'Trapaça' });
    const viewed = (await mod.request<ModUserView>('GET', '/api/mod/users/hisoka')).data;
    expect(viewed.suspension).toEqual({ until: now + 7 * 86_400_000, reason: 'Trapaça' });
    expect(viewed.log[0]).toMatchObject({ action: 'suspend', moderator: 'Zeno', details: '7d · Trapaça' });

    // It ends on its own; a permanent one only when a moderator lifts it.
    now += 8 * 86_400_000;
    expect((await login(client(), 'hisoka')).status).toBe(200);
    expect((await mod.request('POST', '/api/mod/users/hisoka/suspend', { days: null, reason: 'Reincidente' })).status).toBe(200);
    expect((await login(client(), 'hisoka')).data).toMatchObject({ code: 'accountSuspended', until: null });
    expect((await mod.request('POST', '/api/mod/users/hisoka/unsuspend', { reason: 'Recurso aceito' })).status).toBe(200);
    expect((await mod.request('POST', '/api/mod/users/hisoka/unsuspend', { reason: 'De novo' })).data).toMatchObject({ code: 'notSuspended' });
    expect((await login(client(), 'hisoka')).status).toBe(200);
  });

  it('renames an offensive name everywhere, its games included', async () => {
    server = await startServer();
    const mod = client();
    const a = client();
    const b = client();
    await signup(mod, 'Kurapika');
    await signup(a, 'Gido');
    await signup(b, 'Riehlvelt');
    makeModerator(server!, 'kurapika');
    let { id, view } = await startGame(a, b);
    view = await play(a, b, view);
    expect((await mod.request('POST', '/api/mod/users/riehlvelt/rename', { username: 'Gido', reason: 'Nome ofensivo' })).data).toMatchObject({ code: 'usernameTaken' });
    expect((await mod.request('POST', '/api/mod/users/riehlvelt/rename', { username: 'a b', reason: 'Nome ofensivo' })).data).toMatchObject({ code: 'invalidUsername' });
    expect((await mod.request('POST', '/api/mod/users/riehlvelt/rename', { username: 'Player42', reason: 'Nome ofensivo' })).status).toBe(200);
    expect((await a.request<GameView>('GET', `/api/games/${id}`)).data.players.black.name).toBe('Player42');
    expect((await a.request('GET', '/api/users/riehlvelt')).status).toBe(404);
    expect((await a.request<UserProfile>('GET', '/api/users/player42')).data.user.name).toBe('Player42');
    expect(server.app.db.prepare('select count(*) as n from games where black_name = ?').get('Riehlvelt')).toEqual({ n: 0 });
    expect((await mod.request<ModUserView>('GET', '/api/mod/users/player42')).data.log[0]).toMatchObject({ action: 'rename', target: 'Player42', details: 'Riehlvelt → Player42 · Nome ofensivo' });
  });

  it('voids a rated game: the loser gets the points back and the result leaves the statistics', async () => {
    server = await startServer();
    const mod = client();
    const a = client();
    const b = client();
    await signup(mod, 'Biscuit');
    await signup(a, 'Knuckle');
    await signup(b, 'Shoot');
    makeModerator(server!, 'biscuit');
    const rating = async (name: string) => (await mod.request<UserProfile>('GET', `/api/users/${name}`)).data.ratings.intro.rating;
    const before = { a: await rating('knuckle'), b: await rating('shoot') };
    let { id, view } = await startGame(a, b, { ...casual, rated: true });
    view = await play(a, b, view);
    view = await play(b, a, view);
    b.send({ t: 'resign', game: id });
    await a.waitGame(id, (g) => g.status === 'ended');
    expect(await rating('knuckle')).toBeGreaterThan(before.a);

    expect((await a.request('POST', `/api/mod/games/${id}/void`, { reason: 'Motor' })).data).toMatchObject({ code: 'notModerator' });
    expect((await mod.request('POST', `/api/mod/games/${id}/void`, { reason: 'Motor' })).status).toBe(200);
    expect([await rating('knuckle'), await rating('shoot')]).toEqual([before.a, before.b]);
    expect((await mod.request<GameView>('GET', `/api/games/${id}`)).data.voided).toBe(true);
    expect((await mod.request<UserProfile>('GET', '/api/users/knuckle')).data.counts).toMatchObject({ wins: 0 });
    expect((await mod.request('POST', `/api/mod/games/${id}/void`, { reason: 'Motor' })).data).toMatchObject({ code: 'gameNotVoidable' });
    const casualGame = await startGame(a, b);
    expect((await mod.request('POST', `/api/mod/games/${casualGame.id}/void`, { reason: 'Motor' })).data).toMatchObject({ code: 'gameNotVoidable' });
  });
});
