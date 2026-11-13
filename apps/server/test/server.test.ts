import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXTRA_TIME_SECONDS, type ChallengeView, type FriendView, type GameSummary, type GameView, type LeaderEntry, type Leaderboard, type LobbyView, type Me, type PlayersView, type RankingView, type SessionView, type UserProfile, type UserSearchResult } from '@ligungi/protocol';
import { CHALLENGE_TTL } from '../src/lobby.ts';
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
    expect(profile.records.intro).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(profile.records.advanced).toEqual({ wins: 0, draws: 0, losses: 0 });
    expect((await a.request<UserProfile>('GET', '/api/users/meruem')).data.records.intro).toEqual({ wins: 0, draws: 0, losses: 1 });
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

  it('takes back moves in casual games when the opponent agrees', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    const error = (c: Client, code: string) => c.waitFor((m) => m.t === 'error' && m.code === code);
    let { id, view } = await startGame(a, b);
    view = await play(a, b, view);
    view = await play(b, a, view);
    expect(view.canTakeback).toBe(false);
    view = await play(a, b, view);
    expect(view.canTakeback).toBe(true);

    a.send({ t: 'takeback', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.takebackOffer === 'white');
    // Asking back is not accepting: it would take back the other player's move.
    b.send({ t: 'takeback', game: id, action: 'offer' });
    await error(b, 'takebackUnavailable');
    b.send({ t: 'takeback', game: id, action: 'decline' });
    await a.waitGame(id, (g) => g.takebackOffer === null);
    a.send({ t: 'takeback', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.takebackOffer === 'white');
    now += 4000;
    b.send({ t: 'takeback', game: id, action: 'accept' });
    view = await a.waitGame(id, (g) => g.moves.length === 2);
    expect(view).toMatchObject({ takebackOffer: null, clock: { running: 'white' } });
    // The clocks start after the second move. The time Black spent before agreeing stays spent; White's clock is
    // as it was after their move.
    expect(view.clock).toMatchObject({ white: 600_000 + 5000, black: 600_000 - 4000 });

    // On their own turn, the takeback also removes the opponent's reply.
    view = await play(a, b, view);
    view = await play(b, a, view);
    a.send({ t: 'takeback', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.takebackOffer === 'white');
    b.send({ t: 'takeback', game: id, action: 'accept' });
    view = await a.waitGame(id, (g) => g.moves.length === 2 && g.takebackOffer === null);

    // The first two moves stay, and a move cancels a pending request.
    b.send({ t: 'takeback', game: id, action: 'offer' });
    await error(b, 'takebackUnavailable');
    view = await play(a, b, view);
    view = await play(b, a, view);
    b.send({ t: 'takeback', game: id, action: 'offer' });
    await a.waitGame(id, (g) => g.takebackOffer === 'black');
    view = await play(a, b, view);
    expect(view.takebackOffer).toBeNull();
    a.send({ t: 'takeback', game: id, action: 'accept' });
    await error(a, 'noTakebackOffer');

    // Both could ask now; Black asking while White's request is pending must not take back White's move.
    a.send({ t: 'takeback', game: id, action: 'offer' });
    await b.waitGame(id, (g) => g.takebackOffer === 'white');
    b.send({ t: 'takeback', game: id, action: 'offer' });
    await error(b, 'takebackUnavailable');
    view = await b.waitGame(id, (g) => g.takebackOffer === 'white');
    expect(view.moves).toHaveLength(5);
  });

  it('does not take back moves in rated games', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Gon');
    await signup(b, 'Killua');
    let { id, view } = await startGame(a, b, { ...casual, rated: true });
    view = await play(a, b, view);
    view = await play(b, a, view);
    view = await play(a, b, view);
    expect(view.canTakeback).toBe(false);
    a.send({ t: 'takeback', game: id, action: 'offer' });
    await a.waitFor((m) => m.t === 'error' && m.code === 'takebackUnavailable');
  });

  it('gives the opponent extra time, only in games with a clock', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    expect(view.canGiveTime).toBe(true);
    view = await play(a, b, view);
    view = await play(b, a, view);
    now += 2000;
    b.send({ t: 'moretime', game: id });
    view = await a.waitGame(id, (g) => g.clock!.white > 600_000);
    expect(view.clock!.white).toBe(600_000 - 2000 + EXTRA_TIME_SECONDS * 1000);

    ({ id, view } = await startGame(a, b, { ...casual, timeControl: null }));
    expect(view.canGiveTime).toBe(false);
    a.send({ t: 'moretime', game: id });
    await a.waitFor((m) => m.t === 'error' && m.code === 'extraTimeUnavailable');
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
  it('lists online players, site counts and the rating distribution', async () => {
    let now = 1_000_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    const anon = client();
    await signup(a, 'Ging');
    await signup(b, 'Pariston');
    let { id, view } = await startGame(a, b, { ...casual, rated: true });
    view = await play(a, b, view);
    view = await play(b, a, view);
    let players = (await a.request<PlayersView>('GET', '/api/players')).data;
    expect(players.online.map((p) => [p.user.name, p.playing])).toEqual([
      ['Ging', id],
      ['Pariston', id],
    ]);
    expect(players.counts).toMatchObject({ playing: 1, players: 2, gamesTotal: 0, signedIn: 2, free: 0 });
    expect(players.you).toEqual({});

    a.send({ t: 'resign', game: id });
    await b.waitGame(id, (g) => g.status === 'ended');
    // Counts are cached for a minute.
    expect((await a.request<PlayersView>('GET', '/api/players')).data.counts.gamesTotal).toBe(0);
    now += 61_000;
    players = (await a.request<PlayersView>('GET', '/api/players')).data;
    expect(players.counts).toMatchObject({ playing: 0, gamesLastDay: 1, gamesTotal: 1 });
    expect(players.online.find((p) => p.user.name === 'Pariston')).toMatchObject({
      playing: null,
      followed: false,
      canChallenge: true,
      ratings: { intro: { provisional: true, games: 1, rank: null } },
    });
    expect(players.online.find((p) => p.user.name === 'Ging')?.canChallenge).toBe(false);
    expect(players.counts).toMatchObject({ signedIn: 2, free: 2 });
    expect((await a.request('POST', '/api/users/pariston/follow')).status).toBe(200);
    expect((await a.request<PlayersView>('GET', '/api/players')).data.online.find((p) => p.user.name === 'Pariston')?.followed).toBe(true);
    expect(players.distribution.intro.reduce((sum, band) => sum + band.players, 0)).toBe(2);
    expect(players.distribution.advanced).toEqual([]);
    expect(Object.keys(players.you!)).toEqual(['intro']);
    expect((await anon.request<PlayersView>('GET', '/api/players')).data.you).toBeNull();
  });

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

  it('pages the full ranking of a mode with records, search, follows and the viewer place', async () => {
    server = await startServer();
    const a = client();
    for (const name of ['Netero', 'Zeno', 'Meruem', 'Isaac', 'Gon']) await signup(a, name);
    const { db } = server.app;
    const set = (name: string, mode: string, rating: number, deviation: number, games: number) =>
      db
        .prepare('insert into ratings (user_id, mode, rating, deviation, volatility, games) select id, ?, ?, ?, 0.06, ? from users where username = ?')
        .run(mode, rating, deviation, games, name);
    set('Netero', 'advanced', 2100, 60, 40);
    set('Zeno', 'advanced', 1950, 80, 25);
    set('Meruem', 'advanced', 1950, 80, 10);
    set('Isaac', 'advanced', 2400, 200, 3);
    set('Gon', 'advanced', 1800, 90, 20);
    set('Gon', 'intro', 1500, 250, 3);
    const id = (name: string) => (db.prepare('select id from users where username = ?').get(name) as { id: string }).id;
    const game = db.prepare(
      `insert into games (id, mode, rated, first_player, white_session, white_user, white_name, black_session, black_user, black_name, status, winner, reason, created_at, updated_at)
       values (?, ?, ?, 'white', 's', ?, ?, 's', ?, ?, 'ended', ?, 'resign', 1, 1)`,
    );
    game.run('g1', 'advanced', 1, id('Netero'), 'Netero', id('Zeno'), 'Zeno', 'white');
    game.run('g2', 'advanced', 1, id('Gon'), 'Gon', id('Netero'), 'Netero', null);
    game.run('g3', 'advanced', 1, id('Gon'), 'Gon', id('Zeno'), 'Zeno', 'black');
    game.run('g4', 'advanced', 0, id('Gon'), 'Gon', id('Zeno'), 'Zeno', 'white');
    game.run('g5', 'intro', 1, id('Gon'), 'Gon', id('Zeno'), 'Zeno', 'white');

    const view = async (query: string) => (await a.request<RankingView>('GET', `/api/ranking${query}`)).data;
    const advanced = await view('/advanced');
    expect(advanced.rows.map((row) => [row.rank, row.user.name])).toEqual([
      [1, 'Netero'],
      [2, 'Zeno'],
      [2, 'Meruem'],
      [4, 'Gon'],
    ]);
    expect(advanced.rows.map((row) => row.record)).toEqual([
      { wins: 1, draws: 1, losses: 0 },
      { wins: 1, draws: 0, losses: 1 },
      { wins: 0, draws: 0, losses: 0 },
      { wins: 0, draws: 1, losses: 1 },
    ]);
    expect(advanced).toMatchObject({ mode: 'advanced', total: 4, page: 1, you: { rank: 4, page: 1 } });
    expect(advanced.modes.advanced).toEqual({ players: 4, you: { rating: 1800, provisional: false, games: 20, rank: 4 } });
    expect(advanced.modes.intro).toEqual({ players: 0, you: { rating: 1500, provisional: true, games: 3, rank: null } });
    expect(advanced.modes.beginner).toEqual({ players: 0, you: null });
    expect((await view('')).mode).toBe('advanced');

    expect((await view('/advanced?q=ZE')).rows.map((row) => [row.rank, row.user.name])).toEqual([[2, 'Zeno']]);
    expect((await view('/advanced?followed=1')).rows.map((row) => row.user.name)).toEqual(['Gon']);
    expect((await a.request('POST', '/api/users/zeno/follow')).status).toBe(200);
    const followed = await view('/advanced?followed=1');
    expect(followed.rows.map((row) => [row.user.name, row.followed])).toEqual([
      ['Zeno', true],
      ['Gon', false],
    ]);
    expect(followed.total).toBe(2);
    expect(await view('/advanced?page=2')).toMatchObject({ rows: [], total: 4, page: 2 });
    expect(await view('/advanced?page=abc')).toMatchObject({ page: 1, total: 4 });
    for (const page of ['1e20', 'Infinity']) expect((await a.request('GET', `/api/ranking/advanced?page=${page}`)).status).toBe(200);
    expect((await a.request('GET', '/api/ranking/blitz')).status).toBe(404);

    const anonymous = (await client().request<RankingView>('GET', '/api/ranking?followed=1')).data;
    expect(anonymous).toMatchObject({ mode: 'advanced', total: 4, you: null });
    expect(anonymous.modes.advanced.you).toBeNull();
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
      settings: { challengePolicy: string };
      following: string[];
      followers: string[];
      sessions: Array<{ current: boolean }>;
      games: Array<{ id: string; color: string; opponent: string; result: string }>;
      ratings: Record<string, unknown>;
    };
    expect(data.account.username).toBe('Knuckle');
    expect(data.settings).toEqual({ challengePolicy: 'everyone' });
    expect(data.following).toEqual(['Shoot']);
    expect(data.followers).toEqual(['Shoot']);
    expect(data.sessions).toEqual([expect.objectContaining({ current: true })]);
    expect(data.games).toEqual([expect.objectContaining({ id, opponent: 'Shoot', result: 'aborted' })]);
    expect(Object.keys(data.ratings)).toHaveLength(4);
    expect(text).not.toContain(a.cookie.split('=')[1]!);
    expect(text).not.toContain(b.cookie.split('=')[1]!);
    expect((await client().request<{ code: string }>('GET', '/api/account/export')).data.code).toBe('loginRequired');
  });
});

describe('challenges from a profile', () => {
  const directed = { ...casual, to: 'Leorio' };
  const incoming = (c: Client, match: (list: readonly ChallengeView[]) => boolean) =>
    c.waitFor((m) => m.t === 'incoming' && match(m.challenges)) as Promise<{ t: 'incoming'; challenges: readonly ChallengeView[] }>;

  it('reaches the player in real time, and only they can accept', async () => {
    server = await startServer();
    const gon = client();
    const leorio = client();
    const other = client();
    await signup(gon, 'Gon');
    await signup(leorio, 'Leorio');
    await signup(other, 'Zushi');
    await Promise.all([gon.connect(), leorio.connect(), other.connect()]);
    expect((await gon.request<UserProfile>('GET', '/api/users/leorio')).data.canChallenge).toBe(true);
    expect((await gon.request<UserProfile>('GET', '/api/users/gon')).data.canChallenge).toBe(false);
    const created = await gon.request<ChallengeView>('POST', '/api/challenges', directed);
    expect(created.status).toBe(200);
    expect(created.data.destination?.user?.name).toBe('Leorio');
    const notice = await incoming(leorio, (list) => list.length === 1);
    expect(notice.challenges[0]).toMatchObject({ id: created.data.id, challenger: { name: 'Gon' }, mine: false });
    expect((await other.request<{ code: string }>('POST', `/api/challenges/${created.data.id}/accept`)).data.code).toBe('notYourChallenge');
    const accepted = await leorio.request<{ gameId: string }>('POST', `/api/challenges/${created.data.id}/accept`);
    expect(accepted.status).toBe(200);
    await incoming(leorio, (list) => list.length === 0);
    await gon.waitFor((m) => m.t === 'redirect' && m.path === `/${accepted.data.gameId}`);
  });

  it('can be declined, and is withdrawn when the sender leaves', async () => {
    server = await startServer();
    const gon = client();
    const leorio = client();
    await signup(gon, 'Gon');
    await signup(leorio, 'Leorio');
    await Promise.all([gon.connect(), leorio.connect()]);
    gon.send({ t: 'sub', topic: 'lobby' });
    const has = (id: string) => (list: readonly ChallengeView[]) => list.some((c) => c.id === id);
    const first = (await gon.request<ChallengeView>('POST', '/api/challenges', directed)).data;
    gon.send({ t: 'sub', topic: `challenge:${first.id}` });
    await incoming(leorio, has(first.id));
    expect((await leorio.request('POST', `/api/challenges/${first.id}/decline`)).status).toBe(200);
    await gon.waitFor((m) => m.t === 'challenge' && m.challenge.id === first.id && m.challenge.status === 'declined');
    await incoming(leorio, (list) => !has(first.id)(list));
    const second = (await gon.request<ChallengeView>('POST', '/api/challenges', directed)).data;
    await incoming(leorio, has(second.id));
    gon.disconnect();
    await incoming(leorio, (list) => !has(second.id)(list));
    expect((await leorio.request<ChallengeView>('GET', `/api/challenges/${second.id}`)).data.status).toBe('canceled');
  });

  it('expires links and profile challenges after their TTL, with or without other activity', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const gon = client();
    const leorio = client();
    await signup(gon, 'Gon');
    await signup(leorio, 'Leorio');
    await Promise.all([gon.connect(), leorio.connect()]);
    const link = (await gon.request<ChallengeView>('POST', '/api/challenges', casual)).data;
    const sent = (await gon.request<ChallengeView>('POST', '/api/challenges', directed)).data;
    await incoming(leorio, (list) => list.some((c) => c.id === sent.id));
    now += CHALLENGE_TTL;
    expect((await leorio.request<{ code: string }>('POST', `/api/challenges/${link.id}/accept`)).data.code).toBe('challengeUnavailable');
    expect((await leorio.request<ChallengeView>('GET', `/api/challenges/${link.id}`)).data.status).toBe('canceled');
    await incoming(leorio, (list) => !list.some((c) => c.id === sent.id));
    expect((await leorio.request('POST', `/api/challenges/${sent.id}/decline`)).status).toBe(404);
    now += CHALLENGE_TTL;
    expect((await leorio.request('GET', `/api/challenges/${link.id}`)).status).toBe(404);
  });

  it('respects who may challenge and limits pending challenges', async () => {
    server = await startServer();
    const gon = client();
    const leorio = client();
    await signup(gon, 'Gon');
    await signup(leorio, 'Leorio');
    const anon = client();
    expect((await anon.request<{ code: string }>('POST', '/api/challenges', directed)).data.code).toBe('loginRequired');
    expect((await gon.request<{ code: string }>('POST', '/api/challenges', directed)).data.code).toBe('connectionRequired');
    await gon.connect();
    expect((await gon.request<{ code: string }>('POST', '/api/challenges', { ...casual, to: 'gon' })).data.code).toBe('cannotChallengeSelf');
    expect((await gon.request<{ code: string }>('POST', '/api/challenges', { ...casual, to: 'nobody-here' })).data.code).toBe('userNotFound');

    expect((await leorio.request<{ challengePolicy: string }>('GET', '/api/account/settings')).data.challengePolicy).toBe('everyone');
    expect((await leorio.request<{ code: string }>('POST', '/api/account/settings', { challengePolicy: 'maybe' })).data.code).toBe('invalidChallengePolicy');
    await leorio.request('POST', '/api/account/settings', { challengePolicy: 'nobody' });
    expect((await gon.request<UserProfile>('GET', '/api/users/leorio')).data.canChallenge).toBe(false);
    expect((await gon.request<{ code: string }>('POST', '/api/challenges', directed)).data.code).toBe('challengeRefused');
    await leorio.request('POST', '/api/account/settings', { challengePolicy: 'following' });
    expect((await gon.request<{ code: string }>('POST', '/api/challenges', directed)).data.code).toBe('challengeRefused');
    await leorio.request('POST', '/api/users/gon/follow');
    expect((await gon.request<UserProfile>('GET', '/api/users/leorio')).data.canChallenge).toBe(true);

    for (let i = 0; i < 3; i++) expect((await gon.request('POST', '/api/challenges', directed)).status).toBe(200);
    const fourth = await gon.request<{ code: string }>('POST', '/api/challenges', directed);
    expect([fourth.status, fourth.data.code]).toEqual([429, 'tooManyChallenges']);
    expect((await gon.request('POST', '/api/challenges', casual)).status).toBe(200);
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
