import { initialPosition, toFen } from '@ligungi/engine';
import type { NoticeView, ReportView, ServerMessage, UserProfile } from '@ligungi/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { Moderation, moderatorCommand } from '../src/moderation.ts';
import { Users } from '../src/users.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const signup = async (name: string): Promise<Client> => {
  const c = new Client(server!.base);
  expect((await c.request('POST', '/api/signup', { username: name, password: 'segredo123' })).status).toBe(200);
  return c;
};

const isNotices = (m: ServerMessage): m is Extract<ServerMessage, { t: 'notices' }> => m.t === 'notices';
const nextNotices = async (client: Client): Promise<readonly NoticeView[]> => (await client.waitFor(isNotices)).notices;
/** The next list whose newest notice is of `kind`: a list is sent again to every device whenever one of them connects. */
const noticesWith = async (client: Client, kind: NoticeView['kind']): Promise<readonly NoticeView[]> =>
  (await client.waitFor((m): m is Extract<ServerMessage, { t: 'notices' }> => m.t === 'notices' && m.notices[0]?.kind === kind)).notices;

describe('follow policy', () => {
  it('lets a player choose who may start following them', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    const settings = '/api/account/settings';

    expect((await gon.request('GET', settings)).data).toEqual({ challengePolicy: 'everyone', followPolicy: 'everyone' });
    expect((await gon.request('POST', settings, { followPolicy: 'friends' })).data).toMatchObject({ code: 'invalidFollowPolicy' });
    expect((await gon.request('POST', settings, {})).status).toBe(400);
    expect((await gon.request('POST', settings, { followPolicy: 'nobody' })).data).toEqual({ challengePolicy: 'everyone', followPolicy: 'nobody' });
    // The challenge policy alone still saves, as before.
    expect((await gon.request('POST', settings, { challengePolicy: 'nobody' })).data).toEqual({ challengePolicy: 'nobody', followPolicy: 'nobody' });

    expect((await killua.request<UserProfile>('GET', '/api/users/Gon')).data.canFollow).toBe(false);
    expect((await killua.request('POST', '/api/users/Gon/follow')).data).toMatchObject({ code: 'followRefused' });

    // Only the players Gon follows.
    await gon.request('POST', settings, { followPolicy: 'following' });
    expect((await killua.request('POST', '/api/users/Gon/follow')).status).toBe(403);
    expect((await gon.request('POST', '/api/users/Killua/follow')).status).toBe(200);
    expect((await killua.request<UserProfile>('GET', '/api/users/Gon')).data.canFollow).toBe(true);
    expect((await killua.request('POST', '/api/users/Gon/follow')).data).toMatchObject({ followed: true, followers: 1 });

    // A stricter policy keeps the followers there are, lets them leave, and does not let them back in.
    await gon.request('POST', settings, { followPolicy: 'nobody' });
    expect((await killua.request<UserProfile>('GET', '/api/users/Gon')).data).toMatchObject({ followed: true, followers: 1 });
    expect((await killua.request('POST', '/api/users/Gon/follow')).status).toBe(200);
    expect((await killua.request('DELETE', '/api/users/Gon/follow')).data).toMatchObject({ followed: false, canFollow: false });
    expect((await killua.request('POST', '/api/users/Gon/follow')).status).toBe(403);

    const exported = (await gon.request<{ settings: unknown }>('GET', '/api/account/export')).data;
    expect(exported.settings).toEqual({ challengePolicy: 'nobody', followPolicy: 'nobody' });
  });
});

describe('notices', () => {
  it('tells a player once about a new follower, live and on connecting, until read', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    await gon.connect();
    expect(await nextNotices(gon)).toEqual([]);

    await killua.request('POST', '/api/users/Gon/follow');
    const [notice, ...rest] = await nextNotices(gon);
    expect(rest).toEqual([]);
    expect(notice).toMatchObject({ kind: 'follow', actor: 'Killua', subject: null, ref: null, read: false });

    // Following again after leaving is not news a second time.
    await killua.request('DELETE', '/api/users/Gon/follow');
    await killua.request('POST', '/api/users/Gon/follow');
    const other = new Client(server.base);
    expect((await other.request('POST', '/api/login', { username: 'Gon', password: 'segredo123' })).status).toBe(200);
    await other.connect();
    expect((await nextNotices(other)).map((entry) => [entry.kind, entry.read])).toEqual([['follow', false]]);

    // Reading in one place marks it everywhere.
    expect((await killua.request('POST', '/api/notices/read')).status).toBe(200);
    expect((await other.request('POST', '/api/notices/read')).status).toBe(200);
    const read = await gon.waitFor((m): m is Extract<ServerMessage, { t: 'notices' }> => m.t === 'notices' && m.notices.every((entry) => entry.read) && m.notices.length > 0);
    expect(read.notices).toHaveLength(1);
    expect((await new Client(server.base).request('POST', '/api/notices/read')).status).toBe(401);
    gon.disconnect();
    other.disconnect();
  });

  it('tells players what moderation decided, without naming the moderator', async () => {
    server = await startServer();
    const kite = await signup('Kite');
    const palm = await signup('Palm');
    const mod = await signup('Netero');
    moderatorCommand(new Moderation(server.app.db, Date.now), new Users(server.app.db, Date.now), ['moderator', 'add', 'Netero']);
    await kite.connect();
    await palm.connect();
    await nextNotices(kite);
    await nextNotices(palm);

    const chapter = { name: 'Abertura', fen: toFen(initialPosition('intro')), orientation: 'white' };
    const study = (await kite.request<{ id: string }>('POST', '/api/studies', { title: 'Aberturas', description: '', visibility: 'unlisted', chapter })).data;
    expect(study.id).toBeTruthy();
    expect((await palm.request('POST', '/api/reports', { studyId: study.id, reason: 'content', details: '' })).status).toBe(200);
    const [report] = (await mod.request<ReportView[]>('GET', '/api/mod/reports')).data;

    await mod.request('POST', `/api/mod/studies/${study.id}/hide`, { reason: 'Desenho ofensivo' });
    expect((await noticesWith(kite, 'studyHidden'))[0]).toMatchObject({ actor: null, subject: 'Aberturas', ref: study.id });
    // Hiding what is already hidden is not a second decision.
    await mod.request('POST', `/api/mod/studies/${study.id}/hide`, { reason: 'De novo' });
    await mod.request('POST', `/api/mod/studies/${study.id}/hide`, { hidden: false, reason: 'Revisado' });
    expect((await noticesWith(kite, 'studyRestored')).map((entry) => entry.kind)).toEqual(['studyRestored', 'studyHidden']);
    await mod.request('POST', `/api/mod/studies/${study.id}/delete`, { reason: 'Reincidente' });
    expect((await noticesWith(kite, 'studyDeleted'))[0]).toMatchObject({ subject: 'Aberturas', ref: null });

    await mod.request('POST', `/api/mod/reports/${report!.id}/close`, { resolution: 'Estudo apagado' });
    const told = await noticesWith(palm, 'reportClosed');
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ kind: 'reportClosed', actor: null, subject: 'Kite' });
    expect(JSON.stringify(told)).not.toContain('Netero');
    expect(JSON.stringify(told)).not.toContain('Estudo apagado');

    await mod.request('POST', '/api/mod/users/Kite/clear-profile', { reason: 'Link ofensivo' });
    expect((await noticesWith(kite, 'profileCleared'))[0]).toMatchObject({ actor: null, read: false });

    // A rename closes the player's sockets; the notice waits for them to come back.
    expect((await mod.request('POST', '/api/mod/users/Kite/rename', { username: 'Kite2', reason: 'Nome ofensivo' })).status).toBe(200);
    kite.disconnect();
    await kite.connect();
    expect((await noticesWith(kite, 'renamed'))[0]).toMatchObject({ subject: 'Kite2', read: false });

    // Deleting the account takes its notices along.
    expect((await kite.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
    const left = server.app.db.prepare('select count(*) as n from notices where kind != ?').get('reportClosed') as { n: number };
    expect(left.n).toBe(0);
    kite.disconnect();
    palm.disconnect();
  });
});
