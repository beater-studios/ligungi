import type { ChallengeView, GameView, LobbyView, ServerMessage, UserProfile } from '@ligungi/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { Client, firstMove, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
const clients: Client[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server?.close();
  server = undefined;
});

const casual = { mode: 'intro', rated: false, timeControl: { initial: 600, increment: 5 }, color: 'white' };

const signup = async (name: string): Promise<Client> => {
  const c = new Client(server!.base);
  clients.push(c);
  expect((await c.request('POST', '/api/signup', { username: name, password: 'segredo123' })).status).toBe(200);
  return c;
};

const isLobby = (m: ServerMessage): m is Extract<ServerMessage, { t: 'lobby' }> => m.t === 'lobby';

describe('blocking a player', () => {
  it('stops challenges and follows both ways, removes the follows and is listed until undone', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    expect((await killua.request('POST', '/api/users/Gon/follow')).status).toBe(200);
    expect((await gon.request('POST', '/api/users/Killua/follow')).status).toBe(200);

    expect((await gon.request('POST', '/api/users/Gon/block')).data).toMatchObject({ code: 'cannotBlockSelf' });
    expect((await gon.request('POST', '/api/users/Killua/block')).data).toMatchObject({ blocked: true, followed: false, followers: 0 });
    expect((await gon.request<string[]>('GET', '/api/account/blocks')).data).toEqual(['Killua']);
    expect((await gon.request<UserProfile>('GET', '/api/users/Killua')).data).toMatchObject({ blocked: true, followed: false, canFollow: false, canChallenge: false });
    // The blocked player sees no block, only that they can no longer reach the other.
    expect((await killua.request<UserProfile>('GET', '/api/users/Gon')).data).toMatchObject({ blocked: false, followed: false, canFollow: false, canChallenge: false });
    expect((await killua.request('POST', '/api/users/Gon/follow')).data).toMatchObject({ code: 'followRefused' });
    await killua.connect();
    expect((await killua.request('POST', '/api/challenges', { ...casual, to: 'Gon' })).data).toMatchObject({ code: 'challengeRefused' });
    await gon.connect();
    expect((await gon.request('POST', '/api/challenges', { ...casual, to: 'Killua' })).data).toMatchObject({ code: 'challengeRefused' });

    expect((await gon.request('DELETE', '/api/users/Killua/block')).data).toMatchObject({ blocked: false, canFollow: true, canChallenge: true });
    expect((await gon.request<string[]>('GET', '/api/account/blocks')).data).toEqual([]);
    expect((await killua.request('POST', '/api/users/Gon/follow')).status).toBe(200);
  });

  it('never pairs the two in the lobby nor lets one take the other’s game or challenge link', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    await gon.request('POST', '/api/users/Killua/block');
    await gon.connect();
    await killua.connect();

    const seek = { ...casual, color: 'random' };
    const mine = await gon.request<{ seekId?: string }>('POST', '/api/seeks', seek);
    expect(mine.data.seekId).toBeTruthy();
    // A compatible seek from the blocked player opens a seek of its own instead of pairing with Gon's.
    const theirs = await killua.request<{ seekId?: string; gameId?: string }>('POST', '/api/seeks', seek);
    expect(theirs.data.gameId).toBeUndefined();
    expect(theirs.data.seekId).toBeTruthy();
    killua.send({ t: 'sub', topic: 'lobby' });
    const lobby: LobbyView = (await killua.waitFor(isLobby)).lobby;
    expect(lobby.seeks.map((s) => s.id)).not.toContain(mine.data.seekId);
    expect((await killua.request('POST', `/api/seeks/${mine.data.seekId}/accept`)).data).toMatchObject({ code: 'blockedPlayer' });

    const link = await gon.request<ChallengeView>('POST', '/api/challenges', casual);
    expect((await killua.request('POST', `/api/challenges/${link.data.id}/accept`)).data).toMatchObject({ code: 'blockedPlayer' });
    // Anyone else still can.
    const other = await signup('Leorio');
    expect((await other.request<{ gameId?: string }>('POST', `/api/challenges/${link.data.id}/accept`)).data.gameId).toBeTruthy();
  });

  it('cancels the open challenges between the two when one blocks the other', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    await killua.connect();
    const sent = await killua.request<ChallengeView>('POST', '/api/challenges', { ...casual, to: 'Gon' });
    expect(sent.status).toBe(200);
    await gon.request('POST', '/api/users/Killua/block');
    expect((await gon.request('POST', `/api/challenges/${sent.data.id}/accept`)).data).toMatchObject({ code: 'challengeUnavailable' });
  });

  it('refuses a rematch between the two', async () => {
    server = await startServer();
    const gon = await signup('Gon');
    const killua = await signup('Killua');
    const link = await gon.request<ChallengeView>('POST', '/api/challenges', casual);
    const id = (await killua.request<{ gameId: string }>('POST', `/api/challenges/${link.data.id}/accept`)).data.gameId;
    for (const c of [gon, killua]) {
      await c.connect();
      c.send({ t: 'sub', topic: `game:${id}` });
    }
    // Two moves first: a game without them is aborted, not resigned.
    let view: GameView = await gon.waitGame(id, () => true);
    for (const [mover, other] of [[gon, killua], [killua, gon]] as const) {
      const next = view.moves.length + 1;
      mover.send({ t: 'move', game: id, move: firstMove(view), ply: view.moves.length });
      [view] = await Promise.all([mover.waitGame(id, (g) => g.moves.length === next), other.waitGame(id, (g) => g.moves.length === next)]);
    }
    killua.send({ t: 'resign', game: id });
    await gon.waitGame(id, (g) => g.status === 'ended');
    await gon.request('POST', '/api/users/Killua/block');
    killua.send({ t: 'rematch', game: id, action: 'offer' });
    expect(await killua.waitFor((m) => m.t === 'error' && m.code === 'blockedPlayer')).toBeTruthy();
  });
});
