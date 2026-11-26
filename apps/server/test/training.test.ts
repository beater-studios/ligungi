import { applyMove, initialPosition, parseMove, toFen } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { type ExplorerView, type PuzzleAttemptResult, type PuzzleDashboard, type PuzzleRunsView, type PuzzleView } from '@ligungi/protocol';
import { puzzleInfo } from '@ligungi/content';
import { PUZZLES } from '@ligungi/content/puzzles';
import { signup, useServer, type TestServer } from './helpers.ts';

const { start: startServer, client } = useServer();
let server: TestServer | undefined;

describe('puzzles', () => {
  it('rates the first try of each puzzle, picks the next one and the daily one, and keeps a dashboard', async () => {
    server = await startServer();
    const a = client();
    const [first, second] = PUZZLES;
    expect((await a.request('POST', `/api/puzzles/${first!.id}/attempt`, { win: true })).status).toBe(401);
    expect((await a.request('GET', '/api/puzzles/ffffffff')).status).toBe(404);
    // Without an account the next puzzle skips the ones the browser solved.
    const guestNext = (await a.request<{ id: string }>('GET', `/api/puzzles/next?exclude=${first!.id}`)).data.id;
    expect(guestNext).not.toBe(first!.id);
    await signup(a, 'Knuckle');
    expect((await a.request<PuzzleView>('GET', `/api/puzzles/${first!.id}`)).data).toMatchObject({ id: first!.id, plays: 0, attempt: null });

    const won = (await a.request<PuzzleAttemptResult>('POST', `/api/puzzles/${first!.id}/attempt`, { win: true })).data;
    expect(won).toMatchObject({ win: true, counted: true, rating: { games: 1 } });
    expect(won.change).toBeGreaterThan(0);
    // Only the first try counts.
    expect((await a.request<PuzzleAttemptResult>('POST', `/api/puzzles/${first!.id}/attempt`, { win: false })).data).toMatchObject({ counted: false, change: 0 });
    const lost = (await a.request<PuzzleAttemptResult>('POST', `/api/puzzles/${second!.id}/attempt`, { win: false })).data;
    expect(lost.change).toBeLessThan(0);
    expect((await a.request<PuzzleView>('GET', `/api/puzzles/${first!.id}`)).data).toMatchObject({ plays: 1, attempt: { win: true } });
    expect((await a.request('POST', `/api/puzzles/${first!.id}/attempt`, { win: 'yes' })).data).toMatchObject({ code: 'invalidPuzzle' });

    const next = (await a.request<{ id: string }>('GET', '/api/puzzles/next?theme=mateIn1')).data.id;
    expect([first!.id, second!.id]).not.toContain(next);
    expect(puzzleInfo(PUZZLES.find((puzzle) => puzzle.id === next)!).themes).toContain('mateIn1');

    const daily = (await a.request<{ id: string; day: string }>('GET', '/api/puzzles/daily')).data;
    expect((await client().request<{ id: string }>('GET', '/api/puzzles/daily')).data.id).toBe(daily.id);

    const dashboard = (await a.request<PuzzleDashboard>('GET', '/api/puzzles/dashboard')).data;
    expect(dashboard.rating.games).toBe(2);
    expect(dashboard.history.map((entry) => [entry.id, entry.win])).toEqual([
      [first!.id, true],
      [second!.id, false],
    ]);

    // Puzzles solved before signing in are kept as solved, without touching the rating.
    const third = PUZZLES[2]!.id;
    expect((await a.request('POST', '/api/puzzles/solved', { ids: ['ffffffff'] })).data).toMatchObject({ code: 'invalidPuzzle' });
    expect((await a.request<string[]>('POST', '/api/puzzles/solved', { ids: [third] })).data.sort()).toEqual([first!.id, third].sort());
    expect((await a.request<PuzzleDashboard>('GET', '/api/puzzles/dashboard')).data.rating.games).toBe(2);
    expect((await a.request<{ puzzles: { solved: string[] } }>('GET', '/api/account/export')).data.puzzles.solved.sort()).toEqual([first!.id, third].sort());
  });
});

describe('lessons', () => {
  it('keeps the best stars of each exercise, only for known ones and with an account', async () => {
    server = await startServer();
    const a = client();
    expect((await a.request('POST', '/api/lessons/progress', { results: { 'pieces-marshal': 3 } })).status).toBe(401);
    await signup(a, 'Wing');
    expect((await a.request('GET', '/api/lessons/progress')).data).toEqual({});
    for (const results of [{ nope: 3 }, { 'pieces-marshal': 4 }, { 'pieces-marshal': 0 }, { 'pieces-marshal': 2.5 }, ['pieces-marshal']]) {
      expect((await a.request('POST', '/api/lessons/progress', { results })).data).toMatchObject({ code: 'invalidLessonProgress' });
    }
    expect((await a.request('POST', '/api/lessons/progress', { results: { 'pieces-marshal': 2, 'mate-general': 3 } })).data).toEqual({
      'pieces-marshal': 2,
      'mate-general': 3,
    });
    // A worse result never lowers the stars; a better one raises them.
    await a.request('POST', '/api/lessons/progress', { results: { 'mate-general': 1, 'pieces-marshal': 3 } });
    expect((await a.request('GET', '/api/lessons/progress')).data).toEqual({ 'pieces-marshal': 3, 'mate-general': 3 });
    expect((await a.request<{ lessons: Record<string, number> }>('GET', '/api/account/export')).data.lessons).toEqual({ 'pieces-marshal': 3, 'mate-general': 3 });
  });
});

describe('draft explorer', () => {
  it('counts the drafts of finished games by position, with results, filters and the games it leaves out', async () => {
    server = await startServer();
    const insert = server.app.db.prepare(
      `insert into games (id, mode, rated, first_player, white_session, white_name, black_session, black_name, moves, status, winner, reason,
         white_rating, black_rating, voided, free_draft, created_at, updated_at)
       values (?, 'advanced', ?, ?, 'w', 'White', 'b', 'Black', ?, 'ended', ?, 'resign', ?, ?, ?, ?, 0, 0)`,
    );
    insert.run('g1', 1, 'white', 'M*e1 M*e9 P*d1 done', 'white', 1300, 1300, 0, 0);
    insert.run('g2', 1, 'white', 'M*e1 M*e9 P*f1 done', 'black', 1800, 1800, 0, 0);
    insert.run('g3', 0, 'white', 'M*e2 M*e9 done', null, null, null, 0, 0);
    insert.run('voided', 1, 'white', 'M*e1 M*e9 P*d1 done', 'white', 1300, 1300, 1, 0);
    insert.run('free', 0, 'white', 'M*e1 M*e9 P*d1 done', 'white', null, null, 0, 1);
    insert.run('blackFirst', 1, 'black', 'M*e9 M*e1 P*d9 done', 'black', 1300, 1300, 0, 0);
    const a = client();

    const start = (await a.request<ExplorerView>('GET', '/api/explorer?mode=advanced')).data;
    expect(start.total).toMatchObject({ games: 3, white: 1, black: 1, draws: 1 });
    expect(start.moves.map((move) => [move.move, move.games, move.white, move.black, move.draws])).toEqual([
      ['M*e1', 2, 1, 1, 0],
      ['M*e2', 1, 0, 0, 1],
    ]);
    expect(start.moves[0]!.rating).toBe(1550);

    const fen = toFen(['M*e1', 'M*e9'].reduce((position, text) => applyMove(position, parseMove(text)!), initialPosition('advanced')));
    const after = (await a.request<ExplorerView>('GET', `/api/explorer?mode=advanced&fen=${encodeURIComponent(fen)}`)).data;
    expect(after.moves.map((move) => [move.move, move.white, move.black])).toEqual([
      ['P*d1', 1, 0],
      ['P*f1', 0, 1],
    ]);

    expect((await a.request<ExplorerView>('GET', '/api/explorer?mode=advanced&band=below1400')).data.total.games).toBe(1);
    expect((await a.request<ExplorerView>('GET', '/api/explorer?mode=advanced&rated=1')).data.total.games).toBe(2);
    expect((await a.request<ExplorerView>('GET', '/api/explorer?mode=intermediate')).data.total.games).toBe(0);
    expect((await a.request('GET', '/api/explorer?mode=intro')).data).toMatchObject({ code: 'invalidMode' });
    expect((await a.request('GET', '/api/explorer?mode=advanced&band=nope')).data).toMatchObject({ code: 'invalidExplorerQuery' });
    const playFen = toFen(initialPosition('intro'));
    expect((await a.request('GET', `/api/explorer?mode=advanced&fen=${encodeURIComponent(playFen)}`)).data).toMatchObject({ code: 'invalidExplorerQuery' });
  });
});

describe('puzzle runs', () => {
  it('draws harder and harder puzzles for a run, mixing every mode', async () => {
    server = await startServer();
    const a = client();
    const ratingOf = new Map(PUZZLES.map((puzzle) => [puzzle.id, puzzleInfo(puzzle).startRating]));
    const streak = (await a.request<{ ids: string[] }>('GET', '/api/puzzles/sequence?kind=streak')).data.ids;
    expect(streak).toHaveLength(PUZZLES.length);
    expect(new Set(streak).size).toBe(PUZZLES.length);
    const storm = (await a.request<{ ids: string[] }>('GET', '/api/puzzles/sequence?kind=storm')).data.ids;
    expect(storm).toHaveLength(150);
    const average = (ids: string[]) => ids.reduce((sum, id) => sum + ratingOf.get(id)!, 0) / ids.length;
    expect(average(storm.slice(0, 10))).toBeLessThan(1150);
    expect(average(storm.slice(60, 70))).toBeGreaterThan(1400);
    expect(new Set(storm.slice(0, 40).map((id) => puzzleInfo(PUZZLES.find((puzzle) => puzzle.id === id)!).mode)).size).toBeGreaterThan(1);
    expect((await a.request('GET', '/api/puzzles/sequence?kind=racer')).data).toMatchObject({ code: 'invalidPuzzleRun' });
  });

  it('keeps the runs of an account: the recent ones and the best of each kind', async () => {
    server = await startServer();
    const a = client();
    const now = Date.now();
    expect((await a.request('POST', '/api/puzzles/runs', { runs: [{ kind: 'storm', score: 3, at: now }] })).status).toBe(401);
    await signup(a, 'Komugi');
    for (const runs of [[{ kind: 'racer', score: 3, at: now }], [{ kind: 'storm', score: -1, at: now }], [{ kind: 'storm', score: 2.5, at: now }], [{ kind: 'storm', score: 3, at: now + 3_600_000 }], [{ kind: 'storm', score: PUZZLES.length + 1, at: now }], { kind: 'storm' }]) {
      expect((await a.request('POST', '/api/puzzles/runs', { runs })).data).toMatchObject({ code: 'invalidPuzzleRun' });
    }
    const old = now - 30 * 86_400_000;
    const saved = await a.request<PuzzleRunsView>('POST', '/api/puzzles/runs', {
      runs: [
        { kind: 'storm', score: 31, at: old },
        { kind: 'storm', score: 12, at: now - 1000 },
        { kind: 'streak', score: 7, at: now },
      ],
    });
    expect(saved.data).toEqual({
      runs: [
        { kind: 'storm', score: 12, at: now - 1000 },
        { kind: 'streak', score: 7, at: now },
      ],
      best: { streak: 7, storm: 31 },
    });
    expect((await a.request<PuzzleRunsView>('GET', '/api/puzzles/runs')).data).toEqual(saved.data);
    const exported = (await a.request<{ puzzles: { runs: unknown[]; best: unknown } }>('GET', '/api/account/export')).data.puzzles;
    expect(exported.runs).toHaveLength(3);
    expect(exported.best).toEqual({ streak: 7, storm: 31 });
  });
});

describe('practice', () => {
  it('keeps the fewest moves of each finished position, only for known ones and with an account', async () => {
    server = await startServer();
    const a = client();
    const id = 'endgame-hand';
    expect((await a.request('POST', '/api/practice/progress', { results: { [id]: 9 } })).status).toBe(401);
    await signup(a, 'Shoot');
    for (const results of [{ nope: 9 }, { [id]: 0 }, { [id]: 1.5 }, [id]]) {
      expect((await a.request('POST', '/api/practice/progress', { results })).data).toMatchObject({ code: 'invalidPracticeProgress' });
    }
    expect((await a.request('POST', '/api/practice/progress', { results: { [id]: 12 } })).data).toEqual({ [id]: 12 });
    // A longer win never replaces a shorter one.
    await a.request('POST', '/api/practice/progress', { results: { [id]: 15 } });
    expect((await a.request('POST', '/api/practice/progress', { results: { [id]: 9 } })).data).toEqual({ [id]: 9 });
    expect((await a.request<{ practice: Record<string, number> }>('GET', '/api/account/export')).data.practice).toEqual({ [id]: 9 });
  });
});
