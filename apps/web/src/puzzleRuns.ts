import { PUZZLE_RUN_BATCH, PUZZLE_RUN_KINDS, PUZZLE_RUN_RECENT_MS, type PuzzleRun, type PuzzleRunKind, type PuzzleRunsView } from '@ligungi/protocol';
import { useCallback } from 'preact/hooks';
import { api } from './api.ts';
import { localJson, sendOrKeep, useAccountSync } from './syncedProgress.ts';

const store = localJson('ligungi.puzzleRuns');
const WEEK_MS = 7 * 86_400_000;

const isRun = (value: unknown): value is PuzzleRun => {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, score, at } = value as Record<string, unknown>;
  return PUZZLE_RUN_KINDS.some((known) => known === kind) && Number.isInteger(score) && (score as number) >= 0 && Number.isInteger(at);
};

/** The best run of each kind, whenever it was. */
const bestOf = (runs: readonly PuzzleRun[]): Record<PuzzleRunKind, number> =>
  Object.fromEntries(PUZZLE_RUN_KINDS.map((kind) => [kind, Math.max(0, ...runs.filter((run) => run.kind === kind).map((run) => run.score))])) as Record<
    PuzzleRunKind,
    number
  >;

/** Runs kept in the browser without an account: the recent ones and the best of each kind, so the records survive and can move to an account later. */
const readLocal = (): PuzzleRun[] => {
  const value = store.read();
  return Array.isArray(value) ? value.filter(isRun) : [];
};

const writeLocal = (runs: readonly PuzzleRun[]): void => {
  const since = Date.now() - PUZZLE_RUN_RECENT_MS;
  const best = bestOf(runs);
  const kept = runs.filter((run) => run.at >= since || run.score === best[run.kind]);
  store.write(kept.length ? kept.slice(-PUZZLE_RUN_BATCH) : null);
};

const localView = (runs: readonly PuzzleRun[]): PuzzleRunsView => {
  const since = Date.now() - PUZZLE_RUN_RECENT_MS;
  return { runs: runs.filter((run) => run.at >= since), best: bestOf(runs) };
};

export interface RunRecords {
  readonly today: number;
  readonly week: number;
  readonly ever: number;
}

/** The best score today (the viewer's calendar day) and in the last 7 days among `recent`, with the best ever beside them. */
export const bestScores = (recent: readonly { readonly score: number; readonly at: number }[], ever: number, now = Date.now()): RunRecords => {
  const day = new Date(now).toDateString();
  const best = (scores: readonly number[]) => Math.max(0, ...scores);
  return {
    today: best(recent.filter((run) => new Date(run.at).toDateString() === day).map((run) => run.score)),
    week: best(recent.filter((run) => run.at > now - WEEK_MS).map((run) => run.score)),
    ever,
  };
};

/** The best score of a kind today, in the last 7 days and ever. */
export const runRecords = (view: PuzzleRunsView, kind: PuzzleRunKind, now = Date.now()): RunRecords =>
  bestScores(
    view.runs.filter((run) => run.kind === kind),
    view.best[kind],
    now,
  );

/**
 * The player's Streak and Storm runs: on the account when signed in, in the browser otherwise. Runs played before
 * signing in move to the account the first time a run page loads with it.
 */
export const usePuzzleRuns = () => {
  const { view, setView, signedIn } = useAccountSync<PuzzleRun[], PuzzleRunsView>({
    readLocal,
    isEmpty: (local) => local.length === 0,
    guestView: localView,
    upload: (local) => api.post<PuzzleRunsView>('/api/puzzles/runs', { runs: local.slice(-PUZZLE_RUN_BATCH) }),
    load: () => api.get<PuzzleRunsView>('/api/puzzles/runs'),
    clearLocal: () => writeLocal([]),
  });

  const record = useCallback(
    (run: PuzzleRun) => {
      setView((current) => {
        const base = current ?? { runs: [], best: bestOf([]) };
        return { runs: [...base.runs, run], best: { ...base.best, [run.kind]: Math.max(base.best[run.kind], run.score) } };
      });
      sendOrKeep(
        signedIn,
        () => api.post('/api/puzzles/runs', { runs: [run] }),
        () => writeLocal([...readLocal(), run]),
      );
    },
    [signedIn],
  );

  return { view, record };
};
