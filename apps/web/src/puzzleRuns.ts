import { PUZZLE_RUN_BATCH, PUZZLE_RUN_KINDS, PUZZLE_RUN_RECENT_MS, type PuzzleRun, type PuzzleRunKind, type PuzzleRunsView } from '@ligungi/protocol';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.ts';
import { session } from './session.ts';
import { useStore } from './store.ts';

const KEY = 'ligungi.puzzleRuns';
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

/**
 * Runs kept in the browser without an account: the recent ones and the best of each kind, so the records survive and can
 * move to an account later. Storage may be missing (prerender) or blocked.
 */
const readLocal = (): PuzzleRun[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(isRun) : [];
  } catch {
    return [];
  }
};

const writeLocal = (runs: readonly PuzzleRun[]): void => {
  try {
    const since = Date.now() - PUZZLE_RUN_RECENT_MS;
    const best = bestOf(runs);
    const kept = runs.filter((run) => run.at >= since || run.score === best[run.kind]);
    if (kept.length) localStorage.setItem(KEY, JSON.stringify(kept.slice(-PUZZLE_RUN_BATCH)));
    else localStorage.removeItem(KEY);
  } catch {}
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

/** The best score of a kind today (the viewer's calendar day), in the last 7 days and ever. */
export const runRecords = (view: PuzzleRunsView, kind: PuzzleRunKind, now = Date.now()): RunRecords => {
  const runs = view.runs.filter((run) => run.kind === kind);
  const day = new Date(now).toDateString();
  const best = (list: readonly PuzzleRun[]) => Math.max(0, ...list.map((run) => run.score));
  return {
    today: best(runs.filter((run) => new Date(run.at).toDateString() === day)),
    week: best(runs.filter((run) => run.at > now - WEEK_MS)),
    ever: view.best[kind],
  };
};

/**
 * The player's Streak and Storm runs: on the account when signed in, in the browser otherwise. Runs played before
 * signing in move to the account the first time a run page loads with it.
 */
export const usePuzzleRuns = () => {
  const { user, loaded } = useStore(session);
  const [view, setView] = useState<PuzzleRunsView | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const local = readLocal();
    if (!user) {
      setView(localView(local));
      return;
    }
    let alive = true;
    const request = local.length
      ? api.post<PuzzleRunsView>('/api/puzzles/runs', { runs: local.slice(-PUZZLE_RUN_BATCH) }).then((saved) => {
          writeLocal([]);
          return saved;
        })
      : api.get<PuzzleRunsView>('/api/puzzles/runs');
    request.then((saved) => alive && setView(saved)).catch(() => alive && setView(localView(local)));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id]);

  const record = useCallback(
    (run: PuzzleRun) => {
      setView((current) => {
        const base = current ?? { runs: [], best: bestOf([]) };
        return { runs: [...base.runs, run], best: { ...base.best, [run.kind]: Math.max(base.best[run.kind], run.score) } };
      });
      if (user) api.post('/api/puzzles/runs', { runs: [run] }).catch(() => {});
      else writeLocal([...readLocal(), run]);
    },
    [user?.id],
  );

  return { view, record };
};
