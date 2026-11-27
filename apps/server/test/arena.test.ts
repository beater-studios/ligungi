import { describe, expect, it } from 'vitest';
import type { ArenaView, GameView, NoticeView, PlayerArenas, ServerMessage } from '@ligungi/protocol';
import { pairCandidates } from '../src/arenas.ts';
import { arenaMessage } from '../src/arena-announce.ts';
import { firstMove, signup, useServer, type Client } from './helpers.ts';

const { start, client } = useServer();

describe('arena pairing', () => {
  const candidate = (id: string, score: number, lastOpponent: string | null = null, colorBalance = 0, freeSince = 0) => ({ id, score, rating: 1500, lastOpponent, colorBalance, freeSince });

  it('pairs neighbours in the standings and benches whoever has been free the shortest', () => {
    const pairs = pairCandidates([candidate('a', 6, null, 0, 10), candidate('b', 4, null, 0, 50), candidate('c', 2, null, 0, 20), candidate('d', 0, null, 0, 30), candidate('e', 0, null, 0, 40)], () => 0);
    expect(pairs.map((p) => [p.white, p.black].sort())).toEqual([['a', 'c'], ['d', 'e']]);
  });

  it('never leaves the last in the standings out round after round', () => {
    // The last one has waited the longest, so it plays; the one who just finished waits.
    const pairs = pairCandidates([candidate('a', 6, null, 0, 100), candidate('b', 4, null, 0, 90), candidate('z', 0, null, 0, 0)], () => 0);
    expect(pairs.map((p) => [p.white, p.black].sort())).toEqual([['b', 'z']]);
  });

  it('avoids the opponent just played when someone else is free', () => {
    const pairs = pairCandidates([candidate('a', 4, 'b'), candidate('b', 4, 'a'), candidate('c', 2), candidate('d', 0)], () => 0);
    expect(pairs.map((p) => [p.white, p.black].sort())).toEqual([['a', 'c'], ['b', 'd']]);
  });

  it('pairs the same two again when nobody else is free', () => {
    expect(pairCandidates([candidate('a', 2, 'b'), candidate('b', 0, 'a')], () => 0)).toHaveLength(1);
  });

  it('gives White to whoever had it less', () => {
    expect(pairCandidates([candidate('a', 2, null, 1), candidate('b', 0, null, -1)], () => 0)).toEqual([{ white: 'b', black: 'a' }]);
  });
});

describe('arena announcements', () => {
  it('mentions linked players and the role, and names the others', () => {
    const linked = (id: string) => (id === 'u1' ? '111' : null);
    const soon = arenaMessage({ kind: 'soon', arena: 'abc', startsAt: 1_800_000_000_000, joined: 5 }, 'https://ligungi.org', '999', linked);
    expect(soon.content).toContain('<@&999>');
    expect(soon.content).toContain('<t:1800000000:t>');
    expect(soon.content).toContain('https://ligungi.org/arena/abc');
    expect(soon.roles).toEqual(['999']);
    const done = arenaMessage(
      {
        kind: 'finished',
        arena: 'abc',
        players: 9,
        podium: [
          { user: { id: 'u1', name: 'marta' }, rank: 1, score: 22 },
          { user: { id: 'u2', name: 'ryo' }, rank: 2, score: 19 },
        ],
        champion: { id: 'u1', name: 'marta' },
        previousChampion: null,
        next: null,
      },
      'https://ligungi.org',
      null,
      linked,
    );
    expect(done.content).toContain('1st <@111>, 22 points');
    expect(done.content).toContain('2nd ryo, 19 points');
    expect(done.users).toEqual(['111']);
  });
});

describe('weekly arena', () => {
  /** Plays two plies of an Arena game and has `loser` resign, so the other player wins. */
  const win = async (players: Client[], id: string, loserIndex: number) => {
    for (const c of players) c.send({ t: 'sub', topic: `game:${id}` });
    const views = await Promise.all(players.map((c) => c.waitGame(id)));
    let view: GameView = views[0]!;
    for (let ply = 0; ply < 2; ply++) {
      const mover = players.find((_, i) => views[i]!.you === (ply === 0 ? 'white' : 'black'))!;
      mover.send({ t: 'move', game: id, move: firstMove(view), ply: view.moves.length });
      view = await mover.waitGame(id, (g) => g.moves.length === ply + 1);
    }
    players[loserIndex]!.send({ t: 'resign', game: id });
    await players[loserIndex]!.waitGame(id, (g) => g.status === 'ended');
    for (const c of players) c.send({ t: 'unsub', topic: `game:${id}` });
  };

  it('starts with enough players, pairs, scores, finishes and gives trophies', async () => {
    let clock = Date.UTC(2026, 11, 5, 18, 0);
    const server = await start({ now: () => clock });
    const arenas = server.app.arenas;
    const id = arenas.create(clock + 60_000);
    const names = ['ana', 'bia', 'caio', 'davi'];
    const players: Client[] = [];
    for (const name of names) {
      const c = client();
      await signup(c, name);
      await c.connect();
      c.send({ t: 'sub', topic: `arena:${id}` });
      await c.waitFor((m) => m.t === 'arena');
      expect((await c.request('POST', `/api/arena/${id}/join`)).status).toBe(200);
      players.push(c);
    }
    // Not yet: the Arena starts at its time.
    arenas.tick();
    expect(arenas.view(id, null)!.status).toBe('created');

    const games = new Map<string, Client[]>();
    const redirects = (round: number) =>
      Promise.all(
        players.map((c) =>
          c.waitFor((m): m is Extract<ServerMessage, { t: 'redirect' }> => m.t === 'redirect').then((m) => {
            const gameId = m.path.slice(1);
            games.set(`${round}:${gameId}`, [...(games.get(`${round}:${gameId}`) ?? []), c]);
          }),
        ),
      );
    for (let round = 0; round < 3; round++) {
      clock += round === 0 ? 60_000 : 10_000;
      const waiting = redirects(round);
      arenas.tick();
      await waiting;
      const pairs = [...games].filter(([key]) => key.startsWith(`${round}:`));
      expect(pairs).toHaveLength(2);
      // ana wins every game she plays; in the other game, the White player wins.
      for (const [key, pair] of pairs) {
        const gameId = key.split(':')[1]!;
        const anaIndex = pair.indexOf(players[0]!);
        const views = await Promise.all(pair.map((c) => c.request<GameView>('GET', `/api/games/${gameId}`)));
        const loser = anaIndex >= 0 ? 1 - anaIndex : views.findIndex((v) => v.data.you === 'black');
        await win(pair, gameId, loser);
      }
    }
    const running = arenas.view(id, null)!;
    expect(running.status).toBe('started');
    const ana = running.standings[0]!;
    expect(ana.user.name).toBe('ana');
    // Two wins, then a doubled third.
    expect(ana.sheet).toEqual([{ points: 2, doubled: false }, { points: 2, doubled: false }, { points: 4, doubled: true }]);
    expect(ana.score).toBe(8);
    expect(ana.fire).toBe(true);

    clock = running.endsAt!;
    arenas.tick();
    const finished = (await players[0]!.request<ArenaView>('GET', `/api/arena/${id}`)).data;
    expect(finished.status).toBe('finished');
    expect(finished.players).toBe(4);
    // Four players: only the champion gets a trophy.
    expect(finished.standings.map((s) => s.trophy)).toEqual(['arenaChampion', null, null, null]);
    const profile = (await players[1]!.request<PlayerArenas>('GET', '/api/users/ana/arenas')).data;
    expect(profile.counts).toEqual({ champion: 1, podium: 0, top: 0, arenas: 1 });
    expect(profile.trophies[0]).toMatchObject({ kind: 'arenaChampion', place: 1, players: 4, season: 'S0' });
    await players[0]!.waitFor((m) => m.t === 'notices' && m.notices.some((n: NoticeView) => n.kind === 'arenaResult' && n.subject === '1/4/arenaChampion' && n.ref === id));
    // A rematch is not offered in an Arena game.
    const anaGame = [...games].find(([, pair]) => pair.includes(players[0]!))![0].split(':')[1]!;
    players[0]!.send({ t: 'rematch', game: anaGame, action: 'offer' });
    await players[0]!.waitFor((m) => m.t === 'error' && m.code === 'rematchUnavailable');
  });

  it('pauses a player who left when their game is aborted', async () => {
    let clock = Date.UTC(2026, 11, 5, 18, 0);
    const server = await start({ now: () => clock, abortAfterMs: 200 });
    const arenas = server.app.arenas;
    const id = arenas.create(clock);
    const players: Client[] = [];
    for (const name of ['pa1', 'pa2', 'pa3', 'pa4']) {
      const c = client();
      await signup(c, name);
      await c.connect();
      c.send({ t: 'sub', topic: `arena:${id}` });
      await c.waitFor((m) => m.t === 'arena');
      await c.request('POST', `/api/arena/${id}/join`);
      players.push(c);
    }
    const redirects = players.map((c) => c.waitFor((m): m is Extract<ServerMessage, { t: 'redirect' }> => m.t === 'redirect'));
    arenas.tick();
    const games = (await Promise.all(redirects)).map((m) => m.path.slice(1));
    // pa1 leaves without moving; the game is aborted when White's first move does not come.
    players[0]!.disconnect();
    const gameId = games[0]!;
    const room = server.app.games.get(gameId)!;
    // Let the server notice the socket closed, then let the first-move time run out.
    await new Promise((resolve) => setTimeout(resolve, 100));
    clock += 1_000;
    room.tick();
    expect(room.status).toBe('aborted');
    const p1 = (await players[1]!.request<ArenaView>('GET', `/api/arena/${id}`)).data.standings.find((s) => s.user.name === 'pa1')!;
    expect(p1.games).toBe(0);
    expect(p1.state).toBe('away');
    expect(server.app.db.prepare("select paused from arena_players join users on users.id = arena_players.user_id where users.username = 'pa1'").get()).toEqual({ paused: 1 });
  });

  it('waits for missing players, then cancels', async () => {
    let clock = Date.UTC(2026, 11, 5, 18, 0);
    const server = await start({ now: () => clock });
    const arenas = server.app.arenas;
    const id = arenas.create(clock);
    const c = client();
    await signup(c, 'solo');
    expect((await c.request('POST', `/api/arena/${id}/join`)).status).toBe(200);
    arenas.tick();
    expect(arenas.view(id, null)!.status).toBe('created');
    clock += 10 * 60_000;
    arenas.tick();
    expect(arenas.view(id, null)!.status).toBe('canceled');
    expect((await c.request('POST', `/api/arena/${id}/join`)).status).toBe(409);
  });

  it('lets a player leave before the start and requires an account to join', async () => {
    const clock = Date.UTC(2026, 11, 5, 17, 0);
    const server = await start({ now: () => clock });
    const id = server.app.arenas.create(clock + 3_600_000);
    const guest = client();
    expect((await guest.request('POST', `/api/arena/${id}/join`)).status).toBe(401);
    const c = client();
    await signup(c, 'leaver');
    const joined = await c.request<ArenaView>('POST', `/api/arena/${id}/join`);
    expect(joined.data.you).toEqual({ joined: true, paused: false, game: null });
    const left = await c.request<ArenaView>('POST', `/api/arena/${id}/pause`);
    expect(left.data.you?.joined).toBe(false);
    expect(left.data.standings).toHaveLength(0);
    expect((await c.request('GET', '/api/arena/nothere')).status).toBe(404);
    const list = await c.request<{ current: ArenaView | null }>('GET', '/api/arena');
    expect(list.data.current?.id).toBe(id);
  });

  it('creates the next weekly Arena on its own', async () => {
    const clock = Date.UTC(2026, 10, 27, 12, 0);
    const server = await start({ now: () => clock, arenas: true });
    const list = server.app.arenas.list(null);
    expect(list.current?.startsAt).toBe(Date.UTC(2026, 11, 5, 18, 0));
    expect(list.current?.season).toBe('S0');
  });
});
