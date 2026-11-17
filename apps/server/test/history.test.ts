import { legalMoves, moveToString, type Color, type Mode } from '@ligungi/engine';
import { DAY_MS, type ActivityView, type FeedItem, type GameSearchResult, type InsightsView, type StudyView } from '@ligungi/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { Users } from '../src/users.ts';
import { Client, startServer, type TestServer } from './helpers.ts';

let server: TestServer | undefined;
let now = Date.now();
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const start = async () => {
  now = Date.now();
  server = await startServer({ now: () => now });
};

const signup = async (name: string): Promise<Client> => {
  const c = new Client(server!.base);
  expect((await c.request('POST', '/api/signup', { username: name, password: 'segredo123' })).status).toBe(200);
  return c;
};

const idOf = (name: string): string => new Users(server!.app.db, () => now).findByName(name)!.id;

/** A finished game between two accounts: `moves` legal moves, then `loser` resigns. */
const finishedGame = (
  white: string,
  black: string,
  options: { mode?: Mode; rated?: boolean; moves?: number; loser?: Color; draft?: boolean } = {},
) => {
  const room = server!.app.games.create({
    mode: options.mode ?? 'beginner',
    rated: options.rated ?? true,
    timeControl: { initial: 300, increment: 3 },
    daysPerMove: null,
    freeDraft: false,
    players: { white: { sessionId: `${white}-s`, userId: idOf(white), name: white }, black: { sessionId: `${black}-s`, userId: idOf(black), name: black } },
  });
  for (let i = 0; i < (options.moves ?? 4); i++) {
    const legal = legalMoves(room.game.position);
    // In a draft, place pieces and then declare done; afterwards, any move.
    const move = (options.draft && room.game.position.phase === 'draft' ? legal.find((m) => m.kind === 'drop') : undefined) ?? legal.find((m) => m.kind !== 'done') ?? legal[0]!;
    expect(room.move(room.game.position.turn, moveToString(move), room.plies)).toBeNull();
  }
  room.resign(options.loser ?? 'black');
  return room;
};

const search = async (c: Client, query: string) => (await c.request<GameSearchResult>('GET', `/api/games/search?${query}`)).data;

describe('game search', () => {
  it('finds finished games by player, color, opponent, mode, rating, result, reason, date and length', async () => {
    await start();
    const kite = await signup('Kite');
    await signup('Palm');
    await signup('Ikalgo');
    const first = finishedGame('Kite', 'Palm');
    const second = finishedGame('Palm', 'Ikalgo', { mode: 'intro', rated: false, moves: 6, loser: 'white' });
    const ids = (result: GameSearchResult) => result.games.map((game) => game.id).sort();

    expect(ids(await search(kite, ''))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, 'player=kite'))).toEqual([first.id]);
    expect(ids(await search(kite, 'player=Palm'))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, 'player=Palm&result=loss'))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, 'player=Palm&result=win'))).toEqual([]);
    expect(ids(await search(kite, 'player=Palm&color=white'))).toEqual([second.id]);
    expect(ids(await search(kite, 'player=Palm&vs=Ikalgo'))).toEqual([second.id]);
    expect(ids(await search(kite, 'result=black'))).toEqual([second.id]);
    expect(ids(await search(kite, 'mode=intro'))).toEqual([second.id]);
    expect(ids(await search(kite, 'rated=1'))).toEqual([first.id]);
    expect(ids(await search(kite, 'reason=resign'))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, 'ratingMin=1400&ratingMax=1600'))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, 'ratingMax=1000'))).toEqual([]);
    expect(ids(await search(kite, 'movesMin=5'))).toEqual([second.id]);
    expect(ids(await search(kite, 'movesMax=4'))).toEqual([first.id]);
    const today = new Date(now).toISOString().slice(0, 10);
    const yesterday = new Date(now - DAY_MS).toISOString().slice(0, 10);
    expect(ids(await search(kite, `from=${today}&to=${today}`))).toEqual([first.id, second.id].sort());
    expect(ids(await search(kite, `to=${yesterday}`))).toEqual([]);
    expect(await search(kite, 'player=nobody')).toEqual({ games: [], more: false });

    for (const bad of ['result=win', 'color=white', 'vs=Palm', 'mode=chess', 'ratingMin=abc', 'from=2026-02-30', 'page=0', 'reason=checkmate']) {
      expect((await kite.request('GET', `/api/games/search?${bad}`)).data).toMatchObject({ code: 'invalidSearch' });
    }
  });
});

describe('activity and feed', () => {
  it('shows games, public studies and joining to everyone, and training only to the player', async () => {
    await start();
    const kite = await signup('Kite');
    const palm = await signup('Palm');
    now += 8 * DAY_MS;
    finishedGame('Kite', 'Palm');
    const study = (
      await kite.request<StudyView>('POST', '/api/studies', {
        title: 'Finais',
        visibility: 'public',
        chapter: { name: 'Um', fen: '4m4/9/9/9/9/9/9/9/4M4 w - beginner p w', orientation: 'white' },
      })
    ).data;
    await kite.request('POST', '/api/studies', {
      title: 'Rascunho',
      visibility: 'private',
      chapter: { name: 'Um', fen: '4m4/9/9/9/9/9/9/9/4M4 w - beginner p w', orientation: 'white' },
    });
    server!.app.db.prepare('insert into puzzle_attempts (user_id, puzzle_id, win, rating, change, created_at) values (?, ?, 1, 1520, 20, ?)').run(idOf('Kite'), 'abcd1234', now);

    const own = (await kite.request<ActivityView>('GET', '/api/users/Kite/activity')).data;
    expect(own.mine).toBe(true);
    expect(own.events.map((event) => event.kind).sort()).toEqual(['game', 'joined', 'puzzle', 'study']);
    const seen = (await palm.request<ActivityView>('GET', '/api/users/Kite/activity')).data;
    expect(seen.mine).toBe(false);
    expect(seen.events.map((event) => event.kind).sort()).toEqual(['game', 'joined', 'study']);
    expect(seen.events.find((event) => event.kind === 'game')).toMatchObject({ game: { color: 'white', result: 'win', reason: 'resign', opponent: { name: 'Palm' } } });
    expect(seen.events.find((event) => event.kind === 'study')).toMatchObject({ study: { id: study.id, title: 'Finais' } });

    expect((await new Client(server!.base).request('GET', '/api/feed')).status).toBe(401);
    expect((await palm.request<FeedItem[]>('GET', '/api/feed')).data).toEqual([]);
    expect((await palm.request('POST', '/api/users/Kite/follow')).status).toBe(200);
    const feed = (await palm.request<FeedItem[]>('GET', '/api/feed')).data;
    expect(feed.map((item) => [item.user.name, item.event.kind]).sort()).toEqual([
      ['Kite', 'game'],
      ['Kite', 'study'],
    ]);
    // A game between two followed players appears once.
    await signup('Ikalgo');
    expect((await palm.request('POST', '/api/users/Ikalgo/follow')).status).toBe(200);
    finishedGame('Ikalgo', 'Kite');
    const both = (await palm.request<FeedItem[]>('GET', '/api/feed')).data.filter((item) => item.event.kind === 'game');
    expect(both).toHaveLength(2);

    // Older than the feed's week, still in the profile's month.
    now += 8 * DAY_MS;
    expect((await palm.request<FeedItem[]>('GET', '/api/feed')).data).toEqual([]);
    expect((await palm.request<ActivityView>('GET', '/api/users/Kite/activity')).data.events.map((event) => event.kind).sort()).toEqual(['game', 'game', 'joined', 'study']);
    // Past the month, the joining day leaves too.
    now += 15 * DAY_MS;
    expect((await palm.request<ActivityView>('GET', '/api/users/Kite/activity')).data.events.map((event) => event.kind).sort()).toEqual(['game', 'game', 'study']);
  });
});

describe('insights', () => {
  it('looks at the rated games of a mode by opponent, ending, pace, length, opponents and draft', async () => {
    await start();
    const kite = await signup('Kite');
    await signup('Palm');
    finishedGame('Kite', 'Palm');
    finishedGame('Palm', 'Kite', { loser: 'black' });
    finishedGame('Kite', 'Palm', { rated: false });
    finishedGame('Kite', 'Palm', { mode: 'advanced', moves: 2, draft: true });

    const beginner = (await kite.request<InsightsView>('GET', '/api/users/Kite/insights/beginner')).data;
    expect(beginner.games).toBe(2);
    // Even at the first game; after winning it, Kite meets a Palm rated far lower.
    expect(beginner.byOpponent[2]).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(beginner.byOpponent[0]).toEqual({ wins: 0, draws: 0, losses: 1 });
    expect(beginner.endings).toEqual({ win: { resign: 1 }, draw: {}, loss: { resign: 1 } });
    expect(beginner.byPace.clock).toEqual({ wins: 1, draws: 0, losses: 1 });
    expect(beginner.opponents).toEqual([{ user: { id: idOf('Palm'), name: 'Palm' }, record: { wins: 1, draws: 0, losses: 1 } }]);
    expect(beginner.draft).toBeNull();

    const advanced = (await kite.request<InsightsView>('GET', '/api/users/Kite/insights/advanced')).data;
    expect(advanced.games).toBe(1);
    // White placed one piece and the draft did not end, so nothing is said about the pieces held at the start of play.
    expect(Object.values(advanced.draft!.placed)).toEqual([1]);
    expect(advanced.draft!.byHeld).toEqual([
      { wins: 0, draws: 0, losses: 0 },
      { wins: 0, draws: 0, losses: 0 },
      { wins: 0, draws: 0, losses: 0 },
    ]);
    expect((await kite.request('GET', '/api/users/Kite/insights/chess')).data).toMatchObject({ code: 'invalidMode' });
  });
});
