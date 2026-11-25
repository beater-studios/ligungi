import { describe, expect, it } from 'vitest';
import { type FriendView, type GameSummary, type GameView, type LeaderEntry, type Leaderboard, type LobbyView, type PlayersView, type RankingView, type ModeStats, type Crosstable, type UserProfile, type UserSearchResult } from '@ligungi/protocol';
import { Client, casual, makeModerator, play, signup, startGame, useServer, type TestServer } from './helpers.ts';

const { start: startServer, client } = useServer();
let server: TestServer | undefined;

describe('community', () => {
  it('counts whoever is asking as online, before their socket connects (a page reloaded with F5)', async () => {
    server = await startServer();
    const a = client();
    await signup(a, 'Zushi');
    const players = (await a.request<PlayersView>('GET', '/api/players')).data;
    expect(players.online.map((player) => player.user.name)).toEqual(['Zushi']);
    expect(players.counts).toMatchObject({ online: 1, signedIn: 1, free: 1 });
    expect((await a.request<UserProfile>('GET', '/api/users/zushi')).data.online).toBe(true);
    expect((await a.request<LobbyView>('GET', '/api/lobby')).data.online).toBe(1);
    // Someone else sees the account offline until it really connects, and the count does not grow with the socket.
    expect((await client().request<UserProfile>('GET', '/api/users/zushi')).data.online).toBe(false);
    await a.connect();
    a.send({ t: 'sub', topic: 'lobby' });
    await a.waitFor((m) => m.t === 'lobby');
    expect((await a.request<PlayersView>('GET', '/api/players')).data.counts).toMatchObject({ online: 1, signedIn: 1 });
  });

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
    // Recent activity: the newest accounts first, and no finished game yet (the one being played does not count).
    expect(players.recent.players.map((p) => p.user.name)).toEqual(['Pariston', 'Ging']);
    expect(Object.keys(players.recent.players[0]!.user).sort()).toEqual(['id', 'name']);
    expect(players.recent.games).toEqual([]);

    a.send({ t: 'resign', game: id });
    await b.waitGame(id, (g) => g.status === 'ended');
    // Counts are cached for a minute.
    expect((await a.request<PlayersView>('GET', '/api/players')).data.counts.gamesTotal).toBe(0);
    now += 61_000;
    players = (await a.request<PlayersView>('GET', '/api/players')).data;
    expect(players.counts).toMatchObject({ playing: 0, gamesLastDay: 1, gamesTotal: 1 });
    expect(players.recent.games.map((game) => [game.id, game.outcome?.winner])).toEqual([[id, 'black']]);
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
    expect(list[0]).toMatchObject({ user: { name: 'Killua' }, online: false, playing: null, canChallenge: true });
    server.app.db.prepare("update users set challenge_policy = 'nobody' where username = 'Killua'").run();
    expect((await a.request<FriendView[]>('GET', '/api/following')).data[0]?.canChallenge).toBe(false);
    server.app.db.prepare("update users set challenge_policy = 'everyone' where username = 'Killua'").run();

    const { id } = await startGame(b, a);
    list = (await a.request<FriendView[]>('GET', '/api/following')).data;
    expect(list[0]).toMatchObject({ online: true, playing: id });

    await a.request('DELETE', '/api/users/killua/follow');
    expect((await a.request<FriendView[]>('GET', '/api/following')).data).toEqual([]);
    expect((await a.request<UserProfile>('GET', '/api/users/killua')).data).toMatchObject({ followed: false, followers: 0 });
  });

  it('lists live games on the TV with their clocks, and drops the clock once a game ends', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Knov');
    await signup(b, 'Morel');
    const { id, view } = await startGame(a, b);
    expect((await a.request<GameSummary[]>('GET', '/api/tv')).data).toEqual([]);
    // The clock starts once both players have made their first move.
    await play(b, a, await play(a, b, view));
    const [live] = (await a.request<GameSummary[]>('GET', '/api/tv')).data;
    expect(live).toMatchObject({ id, plies: 2, clock: { running: 'white' } });
    expect(live!.clock!.white).toBeGreaterThan(0);
    expect(live!.clock!.black).toBeGreaterThan(0);

    a.send({ t: 'resign', game: id });
    await a.waitGame(id, (g) => g.status === 'ended');
    expect((await a.request<GameSummary[]>('GET', '/api/tv')).data).toEqual([]);
    const [ended] = (await a.request<GameSummary[]>('GET', '/api/users/knov/games')).data;
    expect(ended).toMatchObject({ id, status: 'ended', clock: null });
  });

  it('ranks established players per mode and shows the rank on the profile', async () => {
    server = await startServer();
    const a = client();
    for (const name of ['Netero', 'Zeno', 'Isaac', 'Novato']) await signup(a, name);
    const { db } = server.app;
    const set = (name: string, mode: string, rating: number, deviation: number, games: number, playedAt = Date.now()) =>
      db
        .prepare('insert into ratings (user_id, mode, rating, deviation, volatility, games, played_at) select id, ?, ?, ?, 0.06, ?, ? from users where username = ?')
        .run(mode, rating, deviation, games, playedAt, name);
    set('Netero', 'advanced', 2100.4, 60, 40);
    set('Zeno', 'advanced', 1950, 80, 25);
    set('Isaac', 'advanced', 2400, 200, 3);
    set('Novato', 'intro', 1600, 90, 12);
    // Established, but without a rated game for longer than the leaderboard allows.
    await signup(a, 'Ging');
    set('Ging', 'advanced', 2300, 50, 60, Date.now() - 31 * 86_400_000);

    const board = (await a.request<Leaderboard>('GET', '/api/leaderboard')).data;
    expect(board.advanced.map((entry) => entry.user.name)).toEqual(['Netero', 'Zeno']);
    expect(board.advanced[0]).toMatchObject({ trend: 0 });
    expect((await a.request<UserProfile>('GET', '/api/users/ging')).data.ranks.advanced).toBeNull();
    expect((await a.request<RankingView>('GET', '/api/ranking/advanced')).data.modes.advanced.players).toBe(2);
    expect(board.advanced[0]).toMatchObject({ rating: 2100, games: 40 });
    expect(board.intro.map((entry) => entry.user.name)).toEqual(['Novato']);
    expect(board.beginner).toEqual([]);

    const full = await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced');
    expect(full.data).toHaveLength(2);
    expect((await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced?limit=1')).data.map((e) => e.user.name)).toEqual(['Netero']);
    expect((await a.request<LeaderEntry[]>('GET', '/api/leaderboard/advanced?limit=abc')).data).toHaveLength(2);
    expect((await a.request('GET', '/api/leaderboard/blitz')).status).toBe(400);

    const zeno = (await a.request<UserProfile>('GET', '/api/users/zeno')).data;
    expect(zeno.ranks).toEqual({ intro: null, beginner: null, intermediate: null, advanced: 2 });
    expect((await a.request<UserProfile>('GET', '/api/users/isaac')).data.ranks.advanced).toBeNull();
  });

  it('pages the full ranking of a mode with records, search, follows and the viewer place', async () => {
    server = await startServer();
    const a = client();
    for (const name of ['Netero', 'Zeno', 'Meruem', 'Isaac', 'Gon']) await signup(a, name);
    const { db } = server.app;
    const set = (name: string, mode: string, rating: number, deviation: number, games: number, playedAt = Date.now()) =>
      db
        .prepare('insert into ratings (user_id, mode, rating, deviation, volatility, games, played_at) select id, ?, ?, ?, 0.06, ?, ? from users where username = ?')
        .run(mode, rating, deviation, games, playedAt, name);
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
    expect((await a.request('GET', '/api/ranking/blitz')).status).toBe(400);

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

    // The profile tabs count what the mode, color and opponent filters leave.
    const counts = async (query: string) => (await a.request('GET', `/api/users/biscuit/counts${query}`)).data;
    expect(await counts('')).toEqual({ games: 3, rated: 1, wins: 2, losses: 1, draws: 0 });
    expect(await counts('?mode=intro')).toEqual({ games: 2, rated: 1, wins: 2, losses: 0, draws: 0 });
    expect(await counts('?color=black')).toEqual({ games: 1, rated: 0, wins: 0, losses: 1, draws: 0 });
    expect(await counts('?vs=wing&mode=intro')).toEqual({ games: 2, rated: 1, wins: 2, losses: 0, draws: 0 });
    expect(await counts('?vs=ghost')).toEqual({ games: 0, rated: 0, wins: 0, losses: 0, draws: 0 });
    expect(await counts('?mode=chess')).toMatchObject({ code: 'invalidFilter' });

    // The record between two players, from either side; only their id and name leave the server.
    const crosstable = (await a.request<Crosstable>('GET', '/api/crosstable/biscuit/wing')).data;
    expect(crosstable).toMatchObject({ wins: [2, 0], draws: 0, recent: [{ id: winVsWing, winner: 0 }, { id: ratedWin, winner: 0 }] });
    expect(crosstable.users.map((user) => Object.keys(user).sort())).toEqual([['id', 'name'], ['id', 'name']]);
    expect((await a.request<Crosstable>('GET', '/api/crosstable/wing/biscuit')).data).toMatchObject({ wins: [0, 2], recent: [{ winner: 1 }, { winner: 1 }] });
    expect((await a.request<Crosstable>('GET', '/api/crosstable/wing/zushi')).data).toMatchObject({ wins: [0, 0], draws: 0, recent: [] });
    expect((await a.request('GET', '/api/crosstable/biscuit/ghost')).status).toBe(404);
    expect((await a.request('GET', '/api/crosstable/biscuit/Biscuit')).status).toBe(400);
  });
});

describe('rating history', () => {
  it('lists the rating after each rated game, with the peak, the lowest and the results by color and length', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Ponzu');
    await signup(b, 'Pokkle');
    const rated = { ...casual, rated: true };
    const finish = async (loser: Client, winner: Client, settings: object) => {
      let { id, view } = await startGame(a, b, settings);
      view = await play(a, b, view);
      view = await play(b, a, view);
      loser.send({ t: 'resign', game: id });
      await winner.waitGame(id, (g) => g.status === 'ended');
      return id;
    };
    const first = await finish(b, a, rated);
    await finish(a, b, rated);
    await finish(b, a, casual);
    const stats = (await a.request<ModeStats>('GET', '/api/users/ponzu/stats/intro')).data;
    expect(stats.history).toHaveLength(2);
    const [win, loss] = stats.history;
    expect(win!.change).toBeGreaterThan(0);
    expect(loss!.change).toBeLessThan(0);
    expect(loss!.rating).toBe(win!.rating + loss!.change);
    expect(stats.peak).toEqual({ rating: win!.rating, at: win!.at });
    expect(stats.lowest?.rating).toBe(Math.min(win!.rating, loss!.rating));
    // Ponzu created both challenges with White.
    expect(stats.byColor).toEqual({ white: { wins: 1, draws: 0, losses: 1 }, black: { wins: 0, draws: 0, losses: 0 } });
    expect(stats.byLength).toEqual([{ wins: 1, draws: 0, losses: 1 }, { wins: 0, draws: 0, losses: 0 }, { wins: 0, draws: 0, losses: 0 }]);
    expect((await a.request<ModeStats>('GET', '/api/users/ponzu/stats/advanced')).data.history).toEqual([]);
    expect((await a.request('GET', '/api/users/ponzu/stats/nope')).status).toBe(400);

    // A voided game leaves the history and the results.
    expect(makeModerator(server!, 'pokkle').code).toBe(0);
    await b.request('POST', `/api/mod/games/${first}/void`, { reason: 'Teste' });
    expect((await a.request<ModeStats>('GET', '/api/users/ponzu/stats/intro')).data.history.map((point) => point.gameId)).not.toContain(first);
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
