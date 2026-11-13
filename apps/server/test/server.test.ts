import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChallengeView, FriendView, GameSummary, GameView, LeaderEntry, Leaderboard, LobbyView, Me, UserProfile, UserSearchResult } from '@ligungi/protocol';
import { Client, firstMove, startServer, type TestServer } from './helpers.ts';

const casual = { mode: 'intro', rated: false, timeControl: { initial: 600, increment: 5 }, color: 'white', firstPlayer: 'white' };

let server: TestServer | undefined;
const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await server?.close();
  server = undefined;
});

const client = () => {
  const c = new Client(server!.base);
  clients.push(c);
  return c;
};

const signup = async (c: Client, username: string) => {
  const res = await c.request('POST', '/api/signup', { username, password: 'segredo123' });
  expect(res.status).toBe(200);
};

/** Creates a challenge from `a`, accepts it with `b` and subscribes both to the game. */
const startGame = async (a: Client, b: Client, settings: object = casual) => {
  const created = await a.request<ChallengeView>('POST', '/api/challenges', settings);
  expect(created.status).toBe(200);
  const accepted = await b.request<{ gameId: string }>('POST', `/api/challenges/${created.data.id}/accept`);
  expect(accepted.status).toBe(200);
  const id = accepted.data.gameId;
  for (const c of [a, b]) {
    if (!c.socket) await c.connect();
    c.send({ t: 'sub', topic: `game:${id}` });
  }
  const [viewA] = await Promise.all([a.waitGame(id), b.waitGame(id)]);
  return { id, view: viewA };
};

const play = async (mover: Client, other: Client, view: GameView): Promise<GameView> => {
  const move = firstMove(view);
  mover.send({ t: 'move', game: view.id, move, ply: view.moves.length });
  const next = view.moves.length + 1;
  const [updated] = await Promise.all([
    mover.waitGame(view.id, (g) => g.moves.length === next),
    other.waitGame(view.id, (g) => g.moves.length === next),
  ]);
  return updated;
};

describe('accounts', () => {
  it('signs up, logs out and logs back in', async () => {
    server = await startServer();
    const c = client();
    await signup(c, 'Komugi');
    expect((await c.request<Me>('GET', '/api/me')).data.user?.name).toBe('Komugi');
    expect((await c.request('POST', '/api/signup', { username: 'komugi', password: 'outrasenha' })).status).toBe(409);
    await c.request('POST', '/api/logout', {});
    expect((await c.request<Me>('GET', '/api/me')).data.user).toBeNull();
    expect((await c.request('POST', '/api/login', { username: 'komugi', password: 'errada123' })).status).toBe(401);
    expect((await c.request('POST', '/api/login', { username: 'KOMUGI', password: 'segredo123' })).status).toBe(200);
  });

  it('rejects cross-site and non-JSON writes', async () => {
    server = await startServer();
    const res = await fetch(`${server.base}/api/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });
});

describe('playing online', () => {
  it('plays a challenge game over WebSocket, rejects bad moves, resigns and rematches', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    expect(view.you).toBe('white');
    expect(view.players.white.online).toBe(true);

    b.send({ t: 'move', game: id, move: firstMove(view), ply: 0 });
    expect(await b.waitFor((m) => m.t === 'error')).toEqual({ t: 'error', code: 'notYourTurn', message: 'Não é sua vez.' });
    a.send({ t: 'move', game: id, move: 'a1a9', ply: 0 });
    expect(await a.waitFor((m) => m.t === 'error' && m.message === 'Lance ilegal.')).toBeTruthy();

    view = await play(a, b, view);
    expect(view.clock?.running).toBeNull();
    view = await play(b, a, view);
    expect(view.clock?.running).toBe('white');
    view = await play(a, b, view);

    b.send({ t: 'resign', game: id });
    view = await a.waitGame(id, (g) => g.status === 'ended');
    expect(view.outcome).toEqual({ winner: 'white', reason: 'resign' });

    a.send({ t: 'rematch', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.rematchOffer === 'white');
    b.send({ t: 'rematch', game: id, action: 'accept' });
    const redirect = await a.waitFor((m) => m.t === 'redirect');
    const rematchId = (redirect as { path: string }).path.slice(1);
    const rematch = (await a.request<GameView>('GET', `/api/games/${rematchId}`)).data;
    expect(rematch.you).toBe('black');
    expect(rematch.firstPlayer).toBe('white');
    expect((await a.request<string>('GET', `/api/games/${id}/export`)).data).toContain('[Result "1-0"]');
  });

  it('pairs compatible seeks automatically and keeps the lobby updated', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await a.connect();
    a.send({ t: 'sub', topic: 'lobby' });
    await a.waitFor((m) => m.t === 'lobby');
    const seek = { ...casual, color: 'random', firstPlayer: 'random' };
    expect((await a.request<{ seekId: string }>('POST', '/api/seeks', seek)).data.seekId).toBeTruthy();
    const lobby = await a.waitFor((m) => m.t === 'lobby' && m.lobby.seeks.length === 1);
    expect((lobby as { lobby: LobbyView }).lobby.seeks[0]!.mine).toBe(true);
    await b.connect();
    const paired = await b.request<{ gameId: string }>('POST', '/api/seeks', { ...seek, color: 'black' });
    expect(paired.data.gameId).toBeTruthy();
    const redirect = await a.waitFor((m) => m.t === 'redirect');
    expect(redirect).toEqual({ t: 'redirect', path: `/${paired.data.gameId}` });
    const game = (await a.request<GameView>('GET', `/api/games/${paired.data.gameId}`)).data;
    expect(game.you).toBe('white');
  });

  it('updates ratings after a rated game and shows it on the profiles', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Meruem');
    await signup(b, 'Komugi');
    let { id, view } = await startGame(a, b, { ...casual, rated: true });
    expect(view.players.white.rating).toBe(1500);
    view = await play(a, b, view);
    view = await play(b, a, view);
    a.send({ t: 'resign', game: id });
    view = await b.waitGame(id, (g) => g.status === 'ended');
    expect(view.players.black.ratingDiff).toBeGreaterThan(0);
    expect(view.players.white.ratingDiff).toBeLessThan(0);
    const profile = (await a.request<UserProfile>('GET', '/api/users/komugi')).data;
    expect(profile.ratings.intro.rating).toBeGreaterThan(1500);
    expect(profile.counts).toEqual({ games: 1, rated: 1, wins: 1, losses: 0, draws: 0 });
    expect(profile.recent[0]!.id).toBe(id);
  });

  it('runs the free draft option and never pairs seeks with different draft rules', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    const settings = { ...casual, mode: 'advanced', color: 'white', firstPlayer: 'white', freeDraft: true };
    const { id, view } = await startGame(a, b, settings);
    expect(view.freeDraft).toBe(true);
    const send = async (c: Client, move: string, ply: number) => {
      c.send({ t: 'move', game: id, move, ply });
      return c.waitGame(id, (g) => g.moves.length === ply + 1);
    };
    await send(a, 'M*e1', 0);
    await send(b, 'M*e9', 1);
    await send(a, 'P*d1', 2);
    await send(b, 'done', 3);
    let next = await send(a, 'P*f1', 4);
    expect(next.moves).toHaveLength(5);
    next = await send(a, 'done', 5);
    expect((await a.request<string>('GET', `/api/games/${id}/export`)).data).toContain('[Draft "free"]');

    const c = client();
    const d = client();
    await c.connect();
    await d.connect();
    const seek = { ...casual, color: 'random', firstPlayer: 'random' };
    expect((await c.request<{ seekId?: string }>('POST', '/api/seeks', { ...seek, mode: 'advanced', freeDraft: false })).data.seekId).toBeTruthy();
    const other = await d.request<{ seekId?: string; gameId?: string }>('POST', '/api/seeks', { ...seek, mode: 'advanced', freeDraft: true });
    expect(other.data.gameId).toBeUndefined();
  });

  it('requires an account for rated games', async () => {
    server = await startServer();
    const res = await client().request<{ error: string }>('POST', '/api/seeks', { ...casual, rated: true });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('Entre na sua conta');
    expect((res.data as { code?: string }).code).toBe('loginForRated');
  });

  it('aborts, agrees draws and lets the remaining player claim victory', async () => {
    server = await startServer({ claimAfterMs: 150, abortAfterMs: 200 });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    expect(view.canAbort).toBe(true);
    a.send({ t: 'abort', game: id });
    expect((await b.waitGame(id, (g) => g.status === 'aborted')).outcome).toBeNull();

    ({ id, view } = await startGame(a, b));
    const aborted = await a.waitGame(id, (g) => g.status === 'aborted', 2000);
    expect(aborted.moves).toHaveLength(0);

    ({ id, view } = await startGame(a, b));
    view = await play(a, b, view);
    view = await play(b, a, view);
    a.send({ t: 'draw', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.drawOffer === 'white');
    b.send({ t: 'draw', game: id, action: 'accept' });
    expect((await a.waitGame(id, (g) => g.status === 'ended')).outcome).toEqual({ winner: null, reason: 'agreement' });

    ({ id, view } = await startGame(a, b));
    view = await play(a, b, view);
    view = await play(b, a, view);
    b.disconnect();
    const claimable = await a.waitGame(id, (g) => g.canClaimVictory, 2000);
    expect(claimable.players.black.online).toBe(false);
    a.send({ t: 'claim', game: id });
    expect((await a.waitGame(id, (g) => g.status === 'ended')).outcome).toEqual({ winner: 'white', reason: 'abandon' });
  });

  it('flags the player whose clock runs out', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    view = await play(a, b, view);
    view = await play(b, a, view);
    now += 601_000;
    server.app.games.get(id)!.tick();
    expect((await b.waitGame(id, (g) => g.status === 'ended')).outcome).toEqual({ winner: 'black', reason: 'timeout' });
  });
});

describe('community', () => {
  it('follows and unfollows players and lists them with presence and current game', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    const anon = client();
    await signup(a, 'Gon');
    await signup(b, 'Killua');
    expect((await anon.request('POST', '/api/users/killua/follow')).data).toMatchObject({ code: 'loginRequired' });
    expect((await a.request('POST', '/api/users/gon/follow')).data).toMatchObject({ code: 'cannotFollowSelf' });
    expect((await a.request('POST', '/api/users/nobody/follow')).status).toBe(404);

    const followed = await a.request<{ followed: boolean; followers: number }>('POST', '/api/users/killua/follow');
    expect(followed.data).toMatchObject({ followed: true, followers: 1, following: 0 });
    await a.request('POST', '/api/users/killua/follow');
    expect((await a.request<UserProfile>('GET', '/api/users/killua')).data).toMatchObject({ followed: true, followers: 1 });
    expect((await b.request<UserProfile>('GET', '/api/users/killua')).data.followed).toBe(false);
    expect((await a.request<UserProfile>('GET', '/api/users/gon')).data.following).toBe(1);

    let list = (await a.request<FriendView[]>('GET', '/api/following')).data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ user: { name: 'Killua' }, online: false, playing: null });

    const { id } = await startGame(b, a);
    list = (await a.request<FriendView[]>('GET', '/api/following')).data;
    expect(list[0]).toMatchObject({ online: true, playing: id });

    await a.request('DELETE', '/api/users/killua/follow');
    expect((await a.request<FriendView[]>('GET', '/api/following')).data).toEqual([]);
    expect((await a.request<UserProfile>('GET', '/api/users/killua')).data).toMatchObject({ followed: false, followers: 0 });
  });

  it('ranks established players per mode and shows the rank on the profile', async () => {
    server = await startServer();
    const a = client();
    for (const name of ['Netero', 'Zeno', 'Isaac', 'Novato']) await signup(a, name);
    const { db } = server.app;
    const set = (name: string, mode: string, rating: number, deviation: number, games: number) =>
      db
        .prepare('insert into ratings (user_id, mode, rating, deviation, volatility, games) select id, ?, ?, ?, 0.06, ? from users where username = ?')
        .run(mode, rating, deviation, games, name);
    set('Netero', 'advanced', 2100.4, 60, 40);
    set('Zeno', 'advanced', 1950, 80, 25);
    set('Isaac', 'advanced', 2400, 200, 3);
    set('Novato', 'intro', 1600, 90, 12);

    const board = (await a.request<Leaderboard>('GET', '/api/leaderboard')).data;
    expect(board.advanced.map((entry) => entry.user.name)).toEqual(['Netero', 'Zeno']);
    expect(board.advanced[0]).toMatchObject({ rating: 2100, games: 40 });
    expect(board.intro.map((entry) => entry.user.name)).toEqual(['Novato']);
    expect(board.beginner).toEqual([]);

    const full = await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced');
    expect(full.data).toHaveLength(2);
    expect((await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced?limit=1')).data.map((e) => e.user.name)).toEqual(['Netero']);
    expect((await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced?limit=abc')).data).toHaveLength(2);
    expect((await a.request('GET', '/api/leaderboard/blitz')).status).toBe(404);

    const zeno = (await a.request<UserProfile>('GET', '/api/users/zeno')).data;
    expect(zeno.ranks).toEqual({ intro: null, beginner: null, intermediate: null, advanced: 2 });
    expect((await a.request<UserProfile>('GET', '/api/users/isaac')).data.ranks.advanced).toBeNull();
  });

  it('filters the game history by mode, result, rating, color and opponent', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    const c = client();
    await signup(a, 'Biscuit');
    await signup(b, 'Wing');
    await signup(c, 'Zushi');
    const finish = async (white: Client, black: Client, settings: object, loser: Client) => {
      const { id } = await startGame(white, black, settings);
      const view = await play(white, black, (await white.request<GameView>('GET', `/api/games/${id}`)).data);
      await play(black, white, view);
      loser.send({ t: 'resign', game: id });
      await white.waitGame(id, (g) => g.status === 'ended');
      return id;
    };
    const winVsWing = await finish(a, b, casual, b);
    const lossAsBlack = await finish(c, a, { ...casual, mode: 'beginner' }, a);
    const ratedWin = await finish(a, b, { ...casual, rated: true }, b);

    const history = async (query: string) =>
      (await a.request<GameSummary[]>('GET', `/api/users/biscuit/games${query}`)).data.map((game) => game.id);
    expect(await history('')).toEqual([ratedWin, lossAsBlack, winVsWing]);
    expect(await history('?result=win')).toEqual([ratedWin, winVsWing]);
    expect(await history('?result=loss')).toEqual([lossAsBlack]);
    expect(await history('?result=draw')).toEqual([]);
    expect(await history('?mode=beginner')).toEqual([lossAsBlack]);
    expect(await history('?rated=1')).toEqual([ratedWin]);
    expect(await history('?rated=0&result=win')).toEqual([winVsWing]);
    expect(await history('?color=black')).toEqual([lossAsBlack]);
    expect(await history('?vs=zushi')).toEqual([lossAsBlack]);
    expect(await history('?vs=ghost')).toEqual([]);
    expect(await history('?vs=wing&color=white&mode=intro')).toEqual([ratedWin, winVsWing]);
    const before = (await a.request<GameSummary[]>('GET', '/api/users/biscuit/games')).data[0]!.createdAt;
    expect(await history(`?before=${before}&result=win`)).toEqual([winVsWing]);
    expect((await a.request('GET', '/api/users/biscuit/games?result=maybe')).data).toMatchObject({ code: 'invalidFilter' });
    expect((await a.request<UserProfile>('GET', '/api/users/biscuit')).data.counts).toEqual({ games: 3, rated: 1, wins: 2, losses: 1, draws: 0 });
  });
});

describe('sessions, lobby and robustness', () => {
  it('keeps an anonymous player in their game after they sign up', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    const closed = new Promise<number>((resolve) => a.socket!.once('close', (code) => resolve(code)));
    await signup(a, 'Latecomer');
    expect(await closed).toBe(4001);
    a.disconnect();
    await a.connect();
    a.send({ t: 'sub', topic: `game:${id}` });
    view = await a.waitGame(id);
    expect(view.you).toBe('white');
    view = await play(a, b, view);
    expect(view.moves).toHaveLength(1);
  });

  it('closes sockets that still hold the old identity after logout', async () => {
    server = await startServer();
    const c = client();
    await signup(c, 'Leaver');
    await c.connect();
    const closed = new Promise<number>((resolve) => c.socket!.once('close', (code) => resolve(code)));
    await c.request('POST', '/api/logout');
    expect(await closed).toBe(4001);
  });

  it('needs a live connection to wait in the lobby and clears all seeks of players who start a game', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    const seek = { ...casual, color: 'random', firstPlayer: 'random' };
    const offline = await a.request<{ code: string }>('POST', '/api/seeks', seek);
    expect(offline.status).toBe(409);
    expect(offline.data.code).toBe('connectionRequired');
    await a.connect();
    await b.connect();
    await a.request('POST', '/api/seeks', seek);
    await a.request('POST', '/api/seeks', { ...seek, mode: 'beginner' });
    await b.request('POST', '/api/seeks', { ...seek, mode: 'advanced' });
    expect((await a.request<LobbyView>('GET', '/api/lobby')).data.seeks).toHaveLength(3);
    const paired = await b.request<{ gameId?: string }>('POST', '/api/seeks', seek);
    expect(paired.data.gameId).toBeTruthy();
    expect((await a.request<LobbyView>('GET', '/api/lobby')).data.seeks).toEqual([]);
  });

  it('only subscribes to topics that exist, up to a limit per connection', async () => {
    server = await startServer();
    const a = client();
    await a.connect();
    a.send({ t: 'sub', topic: 'game:nothere1' });
    expect(await a.waitFor((m) => m.t === 'error')).toMatchObject({ code: 'gameNotFound' });
    a.send({ t: 'sub', topic: 'challenge:nothere' });
    expect(await a.waitFor((m) => m.t === 'error')).toMatchObject({ code: 'challengeNotFound' });
    const ids: string[] = [];
    for (let i = 0; i < 33; i++) ids.push((await a.request<ChallengeView>('POST', '/api/challenges', casual)).data.id);
    for (const id of ids.slice(0, 32)) {
      a.send({ t: 'sub', topic: `challenge:${id}` });
      await a.waitFor((m) => m.t === 'challenge' && m.challenge.id === id);
    }
    a.send({ t: 'sub', topic: `challenge:${ids[0]}` });
    await a.waitFor((m) => m.t === 'challenge' && m.challenge.id === ids[0]);
    a.send({ t: 'sub', topic: `challenge:${ids[32]}` });
    expect(await a.waitFor((m) => m.t === 'error')).toMatchObject({ code: 'tooManySubscriptions' });
  });

  it('flags a player whose move arrives after their time ran out', async () => {
    let now = Date.now();
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b, { ...casual, timeControl: { initial: 60, increment: 5 } });
    view = await play(a, b, view);
    view = await play(b, a, view);
    now += 61_000;
    a.send({ t: 'move', game: id, move: firstMove(view), ply: view.moves.length });
    expect(await a.waitFor((m) => m.t === 'error')).toMatchObject({ code: 'gameOver' });
    const ended = await b.waitGame(id, (g) => g.status === 'ended');
    expect(ended.outcome).toEqual({ winner: 'black', reason: 'timeout' });
    expect(ended.moves).toHaveLength(2);
  });

  it('keeps only a bounded number of finished games in memory', async () => {
    server = await startServer();
    const insert = server.app.db.prepare(
      `insert into games (id, mode, rated, first_player, white_session, white_name, black_session, black_name, status, winner, reason, created_at, updated_at)
       values (?, 'intro', 0, 'white', 's', 'A', 's', 'B', 'ended', 'white', 'resign', ?, ?)`,
    );
    for (let i = 0; i < 600; i++) insert.run(`old${String(i).padStart(5, '0')}`, i, i);
    for (let i = 0; i < 600; i++) expect(server.app.games.get(`old${String(i).padStart(5, '0')}`)).toBeDefined();
    expect(server.app.games.cachedCount).toBe(500);
    expect(server.app.games.get('old00000')?.status).toBe('ended');
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

describe('search and health', () => {
  it('finds players by name prefix, case-insensitive, with presence', async () => {
    server = await startServer();
    const a = client();
    for (const name of ['Gon', 'Gotoh', 'Genthru', 'Killua']) await signup(client(), name);
    await signup(a, 'Goreinu');
    await a.connect();
    const search = async (q: string) => (await a.request<UserSearchResult[]>('GET', `/api/users?q=${encodeURIComponent(q)}`)).data;
    expect((await search('go')).map((r) => r.user.name)).toEqual(['Gon', 'Goreinu', 'Gotoh']);
    expect((await search('GO')).map((r) => r.user.name)).toEqual(['Gon', 'Goreinu', 'Gotoh']);
    expect((await search('gor'))[0]).toMatchObject({ user: { name: 'Goreinu' }, online: true });
    expect(await search('g')).toEqual([]);
    expect(await search("go'; drop table users")).toEqual([]);
    expect(await search('zzz')).toEqual([]);
  });

  it('reports health with the build', async () => {
    server = await startServer();
    const res = await client().request<{ ok: boolean; version: string }>('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('persistence', () => {
  it('keeps ongoing and finished games across restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ligungi-'));
    const databasePath = join(dir, 'test.db');
    try {
      server = await startServer({ databasePath });
      const a = client();
      const b = client();
      let { id, view } = await startGame(a, b);
      view = await play(a, b, view);
      view = await play(b, a, view);
      a.disconnect();
      b.disconnect();
      await server.close();

      server = await startServer({ databasePath });
      const restored = new Client(server.base);
      restored.cookie = a.cookie;
      clients.push(restored);
      const game = (await restored.request<GameView>('GET', `/api/games/${id}`)).data;
      expect(game.status).toBe('started');
      expect(game.moves).toEqual(view.moves);
      expect(game.you).toBe('white');
      await restored.connect();
      restored.send({ t: 'sub', topic: `game:${id}` });
      await restored.waitGame(id);
      restored.send({ t: 'resign', game: id });
      await restored.waitGame(id, (g) => g.status === 'ended');
      await server.close();

      server = await startServer({ databasePath });
      const later = new Client(server.base);
      later.cookie = restored.cookie;
      const finished = (await later.request<GameView>('GET', `/api/games/${id}`)).data;
      expect(finished.outcome).toEqual({ winner: 'black', reason: 'resign' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
