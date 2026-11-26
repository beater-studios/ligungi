import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTRA_TIME_SECONDS, type ChallengeView, type GameSummary, type GameView, type LobbyView, type Me, type PlayersView, type BookmarkedGame, type BookmarkView, type UserProfile } from '@ligungi/protocol';
import { CHALLENGE_TTL } from '../src/lobby.ts';
import { Client, casual, firstMove, play, signup, startGame, useServer, type TestServer } from './helpers.ts';

const { start: startServer, client } = useServer();
let server: TestServer | undefined;

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
    const seek = { ...casual, color: 'random' };
    expect((await a.request<{ seekId: string }>('POST', '/api/seeks', seek)).data.seekId).toBeTruthy();
    const lobby = await a.waitFor((m) => m.t === 'lobby' && m.lobby.seeks.length === 1);
    expect((lobby as { lobby: LobbyView }).lobby.seeks[0]!.mine).toBe(true);
    await b.connect();
    // A first player sent by an older page is ignored: White always starts.
    const paired = await b.request<{ gameId: string }>('POST', '/api/seeks', { ...seek, color: 'black', firstPlayer: 'black' });
    expect(paired.data.gameId).toBeTruthy();
    const redirect = await a.waitFor((m) => m.t === 'redirect');
    expect(redirect).toEqual({ t: 'redirect', path: `/${paired.data.gameId}` });
    const game = (await a.request<GameView>('GET', `/api/games/${paired.data.gameId}`)).data;
    expect(game.you).toBe('white');
    expect(game.firstPlayer).toBe('white');
  });

  it('sends the live games to the tv topic on subscribing and after each move, and lists the channels', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    const watcher = client();
    await watcher.connect();
    watcher.send({ t: 'sub', topic: 'tv' });
    expect(await watcher.waitFor((m) => m.t === 'tv')).toEqual({ t: 'tv', games: [] });
    let { id, view } = await startGame(a, b);
    view = await play(a, b, view);
    let update = (await watcher.waitFor((m) => m.t === 'tv' && m.games.length === 1)) as { games: readonly GameSummary[] };
    expect(update.games[0]).toMatchObject({ id, plies: 1, turn: 'black' });
    await play(b, a, view);
    update = (await watcher.waitFor((m) => m.t === 'tv' && m.games[0]?.plies === 2)) as { games: readonly GameSummary[] };
    expect(update.games[0]).toMatchObject({ id, turn: 'white' });
    const channels = (await watcher.request<{ channel: string; game: GameSummary | null }[]>('GET', '/api/tv/channels')).data;
    expect(channels.map((c) => [c.channel, c.game?.id ?? null])).toEqual([
      ['best', id],
      ['intro', id],
      ['beginner', null],
      ['intermediate', null],
      ['advanced', null],
    ]);
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
    const settings = { ...casual, mode: 'advanced', color: 'white', freeDraft: true };
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
    const seek = { ...casual, color: 'random' };
    expect((await c.request<{ seekId?: string }>('POST', '/api/seeks', { ...seek, mode: 'advanced', freeDraft: false })).data.seekId).toBeTruthy();
    const other = await d.request<{ seekId?: string; gameId?: string }>('POST', '/api/seeks', { ...seek, mode: 'advanced', freeDraft: true });
    expect(other.data.gameId).toBeUndefined();
  });

  it('requires an account for rated games', async () => {
    server = await startServer();
    const res = await client().request<{ error: string }>('POST', '/api/seeks', { ...casual, rated: true });
    expect(res.status).toBe(401);
    expect(res.data.error).toContain('Entre na sua conta');
    expect((res.data as { code?: string }).code).toBe('loginForRated');
  });

  it('aborts a game on request, and on its own when nobody moves in time', async () => {
    server = await startServer({ abortAfterMs: 200 });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
    expect(view.canAbort).toBe(true);
    a.send({ t: 'abort', game: id });
    expect((await b.waitGame(id, (g) => g.status === 'aborted')).outcome).toBeNull();

    ({ id, view } = await startGame(a, b));
    const aborted = await a.waitGame(id, (g) => g.status === 'aborted', 2000);
    expect(aborted.moves).toHaveLength(0);
  });

  // The automatic abort keeps its default here: with it at a fraction of a second, a busy machine could abort these
  // games before both players have moved.
  it('agrees draws and lets the remaining player claim victory', async () => {
    server = await startServer({ claimAfterMs: 150 });
    const a = client();
    const b = client();
    let { id, view } = await startGame(a, b);
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
    const seek = { ...casual, color: 'random' };
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

describe('correspondence', () => {
  const corr = (days: number, extra: object = {}) => ({ ...casual, mode: 'intro', rated: true, timeControl: null, daysPerMove: days, ...extra });

  it('creates games with an account and 1, 3, 7 or 14 days per move', async () => {
    server = await startServer();
    const anon = client();
    const a = client();
    await signup(a, 'Leorio');
    await a.connect();
    expect((await anon.request('POST', '/api/seeks', corr(3, { rated: false }))).data).toMatchObject({ code: 'correspondenceNeedsAccount' });
    expect((await a.request('POST', '/api/challenges', corr(2))).data).toMatchObject({ code: 'invalidDaysPerMove' });
    expect((await a.request('POST', '/api/challenges', corr(3, { timeControl: { initial: 600, increment: 5 } }))).data).toMatchObject({
      code: 'invalidDaysPerMove',
    });
    expect((await anon.request('POST', '/api/challenges', corr(3, { rated: false }))).data).toMatchObject({ code: 'correspondenceNeedsAccount' });
    const link = await a.request<ChallengeView>('POST', '/api/challenges', corr(3));
    expect(link.data.settings).toMatchObject({ daysPerMove: 3, timeControl: null, rated: true });
    expect((await anon.request('POST', `/api/challenges/${link.data.id}/accept`)).data).toMatchObject({ code: 'correspondenceNeedsAccount' });
    expect((await a.request<ChallengeView>('POST', '/api/challenges', corr(14))).data.settings).toMatchObject({ daysPerMove: 14, rated: true });
    expect((await a.request('POST', '/api/challenges', corr(10))).data).toMatchObject({ code: 'invalidDaysPerMove' });
  });

  it('keeps a seek in the lobby for days, with its owner away or playing, and pairs it only with the same pace', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    const c = client();
    await signup(a, 'Gon');
    await signup(b, 'Killua');
    await signup(c, 'Alluka');
    // No connection needed: the seek does not depend on its owner staying online.
    const seek = await a.request<{ seekId: string }>('POST', '/api/seeks', corr(3));
    expect(seek.data.seekId).toBeDefined();
    await a.connect();
    a.disconnect();
    // Not the same pace: a game without a clock, or with other days per move, opens its own seek.
    await b.connect();
    expect((await b.request('POST', '/api/seeks', { ...casual, color: 'black', timeControl: null })).data).toHaveProperty('seekId');
    expect((await b.request('POST', '/api/seeks', corr(7, { color: 'black' }))).data).toHaveProperty('seekId');
    // A live game of the owner leaves it waiting.
    await startGame(a, c);
    const lobby = () => b.request<LobbyView>('GET', '/api/lobby').then((r) => r.data.seeks.map((s) => s.id));
    expect(await lobby()).toContain(seek.data.seekId);
    now += 6 * 24 * 60 * 60 * 1000;
    const paired = await b.request<{ gameId: string }>('POST', '/api/seeks', corr(3, { color: 'black' }));
    expect(paired.data.gameId).toBeDefined();
    const view = (await b.request<GameView>('GET', `/api/games/${paired.data.gameId}`)).data;
    expect(view).toMatchObject({ daysPerMove: 3, rated: true });
    expect(await lobby()).not.toContain(seek.data.seekId);
    // Seven days without an answer: gone from the lobby.
    const old = (await c.request<{ seekId: string }>('POST', '/api/seeks', corr(1))).data.seekId;
    now += 7 * 24 * 60 * 60 * 1000;
    // Any lobby write sweeps first (as does a timer every minute).
    await b.request('POST', '/api/seeks', corr(1, { mode: 'advanced' }));
    expect(await lobby()).not.toContain(old);
  });

  it('keeps a challenge to a player while its sender is away, for days', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    await signup(a, 'Kurapika');
    await signup(b, 'Pairo');
    await a.connect();
    const sent = await a.request<ChallengeView>('POST', '/api/challenges', { ...corr(7), to: 'pairo' });
    a.disconnect();
    now += 3 * 60 * 60 * 1000;
    expect((await b.request<ChallengeView>('GET', `/api/challenges/${sent.data.id}`)).data.status).toBe('open');
    now += 7 * 24 * 60 * 60 * 1000;
    expect((await b.request<ChallengeView>('GET', `/api/challenges/${sent.data.id}`)).data.status).toBe('canceled');
  });

  it('gives each player days per move, never a win for absence, and ends on the deadline', async () => {
    let now = 1_000_000;
    server = await startServer({ now: () => now });
    const a = client();
    const b = client();
    await signup(a, 'Melody');
    await signup(b, 'Senritsu');
    const day = 24 * 60 * 60 * 1000;

    // No move by the deadline: aborted, as nobody really started the game.
    let { id } = await startGame(a, b, corr(1));
    let view = (await a.request<GameView>('GET', `/api/games/${id}`)).data;
    expect(view).toMatchObject({ daysPerMove: 1, clock: null, deadlineIn: day });
    now += day;
    server.app.games.get(id)!.tick();
    expect((await a.waitGame(id, (g) => g.status !== 'started')).status).toBe('aborted');

    ({ id } = await startGame(a, b, corr(1)));
    view = (await a.request<GameView>('GET', `/api/games/${id}`)).data;
    view = await play(a, b, view);
    now += 20 * 60 * 60 * 1000;
    view = await play(b, a, view);
    // The deadline starts over with every move.
    expect(view.deadlineIn).toBe(day);
    // Not a game being played right now: kept off the TV and the live count, and its players stay free.
    expect((await a.request<GameSummary[]>('GET', '/api/tv')).data).toEqual([]);
    expect((await a.request<LobbyView>('GET', '/api/lobby')).data.playing).toBe(0);
    expect((await a.request<PlayersView>('GET', '/api/players')).data.counts).toMatchObject({ playing: 0, free: 2 });
    const [summary] = (await a.request<Me>('GET', '/api/me')).data.playing;
    expect(summary).toMatchObject({ id, daysPerMove: 1, deadlineIn: day, turn: 'white' });
    // White is told, wherever they are on the site, that the game waits for them; Black no longer has it in the list.
    await a.waitFor((m) => m.t === 'turns' && m.games.some((game) => game.id === id));
    await b.waitFor((m) => m.t === 'turns' && !m.games.some((game) => game.id === id));
    b.disconnect();
    now += 60_000;
    expect((await a.request<GameView>('GET', `/api/games/${id}`)).data.canClaimVictory).toBe(false);
    now += day;
    server.app.games.get(id)!.tick();
    const ended = await a.waitGame(id, (g) => g.status === 'ended');
    expect(ended.outcome).toEqual({ winner: 'black', reason: 'timeout' });
    expect(ended.players.white.ratingDiff).not.toBeNull();

    // 14 days: still on time a minute before the deadline, lost on it.
    ({ id } = await startGame(a, b, corr(14)));
    view = (await a.request<GameView>('GET', `/api/games/${id}`)).data;
    expect(view.deadlineIn).toBe(14 * day);
    view = await play(a, b, view);
    view = await play(b, a, view);
    expect(view.deadlineIn).toBe(14 * day);
    now += 14 * day - 60_000;
    server.app.games.get(id)!.tick();
    expect((await a.request<GameView>('GET', `/api/games/${id}`)).data.status).toBe('started');
    now += 60_000;
    server.app.games.get(id)!.tick();
    expect((await a.waitGame(id, (g) => g.status === 'ended')).outcome).toEqual({ winner: 'black', reason: 'timeout' });
  });
});

describe('bookmarks', () => {
  it('bookmarks games with a private note, lists them for their owner only and drops them with the account data', async () => {
    server = await startServer();
    const a = client();
    const b = client();
    await signup(a, 'Biscuit');
    await signup(b, 'Wing');
    const { id: first } = await startGame(a, b, casual);
    const { id: second } = await startGame(a, b, casual);

    expect((await client().request('POST', `/api/games/${first}/bookmark`, {})).status).toBe(401);
    expect((await a.request('POST', '/api/games/nope1234/bookmark', {})).status).toBe(404);
    expect((await a.request<BookmarkView>('GET', `/api/games/${first}/bookmark`)).data).toEqual({ bookmarked: false, note: '' });
    expect((await a.request<BookmarkView>('POST', `/api/games/${first}/bookmark`, {})).data).toEqual({ bookmarked: true, note: '' });
    expect((await a.request<BookmarkView>('POST', `/api/games/${first}/bookmark`, { note: '  Lindo sacrifício no lance 30  ' })).data).toEqual({
      bookmarked: true,
      note: 'Lindo sacrifício no lance 30',
    });
    expect((await a.request('POST', `/api/games/${first}/bookmark`, { note: 'x'.repeat(1001) })).data).toMatchObject({ code: 'invalidBookmarkNote' });
    expect((await a.request('POST', `/api/games/${first}/bookmark`, { note: 7 })).data).toMatchObject({ code: 'invalidBookmarkNote' });
    await a.request('POST', `/api/games/${second}/bookmark`, {});

    const list = (await a.request<BookmarkedGame[]>('GET', '/api/bookmarks')).data;
    expect(list.map((bookmark) => [bookmark.game.id, bookmark.note])).toEqual([
      [second, ''],
      [first, 'Lindo sacrifício no lance 30'],
    ]);
    // Someone else's bookmarks stay theirs.
    expect((await b.request<BookmarkedGame[]>('GET', '/api/bookmarks')).data).toEqual([]);
    expect((await b.request<BookmarkView>('GET', `/api/games/${first}/bookmark`)).data.bookmarked).toBe(false);

    expect((await a.request<BookmarkView>('DELETE', `/api/games/${second}/bookmark`)).data).toEqual({ bookmarked: false, note: '' });
    const exported = (await a.request<{ bookmarks: Array<{ game: string; note: string }> }>('GET', '/api/account/export')).data.bookmarks;
    expect(exported.map((bookmark) => bookmark.game)).toEqual([first]);
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
      const restored = client();
      restored.cookie = a.cookie;
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

  it('keeps correspondence seeks across restarts, exports them and forgets them with the account', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ligungi-'));
    const databasePath = join(dir, 'test.db');
    try {
      server = await startServer({ databasePath });
      const a = client();
      await signup(a, 'Ikalgo');
      await a.connect();
      const correspondence = (await a.request<{ seekId: string }>('POST', '/api/seeks', { ...casual, timeControl: null, daysPerMove: 3 })).data.seekId;
      await a.request('POST', '/api/seeks', casual);
      a.disconnect();
      await server.close();

      server = await startServer({ databasePath });
      const ikalgo = client();
      ikalgo.cookie = a.cookie;
      const lobby = (await ikalgo.request<LobbyView>('GET', '/api/lobby')).data;
      expect(lobby.seeks).toEqual([expect.objectContaining({ id: correspondence, mine: true, settings: expect.objectContaining({ daysPerMove: 3 }) })]);
      const exported = (await ikalgo.request<{ seeks: Array<{ id: string }> }>('GET', '/api/account/export')).data;
      expect(exported.seeks).toEqual([expect.objectContaining({ id: correspondence })]);
      expect((await ikalgo.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
      expect((server.app.db.prepare('select count(*) as n from seeks').get() as { n: number }).n).toBe(0);
      expect((await ikalgo.request<LobbyView>('GET', '/api/lobby')).data.seeks).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps correspondence challenges across restarts, exports them and forgets them with the account', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ligungi-'));
    const databasePath = join(dir, 'test.db');
    try {
      server = await startServer({ databasePath });
      const a = client();
      const b = client();
      await signup(a, 'Biscuit');
      await signup(b, 'Wing');
      await a.connect();
      const correspondence = (await a.request<ChallengeView>('POST', '/api/challenges', { ...casual, timeControl: null, daysPerMove: 3, to: 'wing' })).data;
      const live = (await a.request<ChallengeView>('POST', '/api/challenges', casual)).data;
      a.disconnect();
      await server.close();

      server = await startServer({ databasePath });
      const wing = client();
      wing.cookie = b.cookie;
      expect((await wing.request<ChallengeView>('GET', `/api/challenges/${correspondence.id}`)).data).toMatchObject({ status: 'open', destination: { name: 'Wing' } });
      expect((await wing.request('GET', `/api/challenges/${live.id}`)).status).toBe(404);
      const exported = (await wing.request<{ challenges: Array<{ id: string; sent: boolean; opponent: string; status: string }> }>('GET', '/api/account/export')).data;
      expect(exported.challenges).toEqual([expect.objectContaining({ id: correspondence.id, sent: false, opponent: 'Biscuit', status: 'open' })]);
      const accepted = await wing.request<{ gameId: string }>('POST', `/api/challenges/${correspondence.id}/accept`);
      expect(accepted.status).toBe(200);
      await server.close();

      server = await startServer({ databasePath });
      const again = client();
      again.cookie = b.cookie;
      expect((await again.request<ChallengeView>('GET', `/api/challenges/${correspondence.id}`)).data).toMatchObject({ status: 'accepted' });
      const count = () => (server!.app.db.prepare('select count(*) as n from challenges').get() as { n: number }).n;
      expect(count()).toBe(1);
      // Deleting the account needs no game in progress: resign the correspondence game first.
      await again.connect();
      again.send({ t: 'sub', topic: `game:${accepted.data.gameId}` });
      await again.waitGame(accepted.data.gameId);
      again.send({ t: 'resign', game: accepted.data.gameId });
      await again.waitGame(accepted.data.gameId, (g) => g.status !== 'started');
      expect((await again.request('POST', '/api/account/delete', { password: 'segredo123' })).status).toBe(200);
      expect(count()).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps a correspondence deadline across restarts instead of starting it over', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ligungi-'));
    const databasePath = join(dir, 'test.db');
    let now = 1_000_000;
    try {
      server = await startServer({ databasePath, now: () => now });
      const a = client();
      const b = client();
      await signup(a, 'Neon');
      await signup(b, 'Nostrade');
      const { id } = await startGame(a, b, { ...casual, timeControl: null, daysPerMove: 3 });
      a.disconnect();
      b.disconnect();
      await server.close();

      now += 2 * 24 * 60 * 60 * 1000;
      server = await startServer({ databasePath, now: () => now });
      const restored = client();
      restored.cookie = a.cookie;
      expect((await restored.request<GameView>('GET', `/api/games/${id}`)).data.deadlineIn).toBe(24 * 60 * 60 * 1000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
