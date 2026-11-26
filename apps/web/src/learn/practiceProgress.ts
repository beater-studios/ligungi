import { PRACTICE_BATCH } from '@ligungi/protocol';
import { PRACTICE_POSITIONS } from '@ligungi/content';
import { useCallback } from 'preact/hooks';
import { api } from '../core/api.ts';
import { localJson, sendOrKeep, useAccountSync } from '../syncedProgress.ts';

const store = localJson('ligungi.practice');
const KNOWN: ReadonlySet<string> = new Set(PRACTICE_POSITIONS.map((position) => position.id));

export type PracticeProgress = Readonly<Record<string, number>>;

const valid = (id: string, moves: unknown): moves is number =>
  KNOWN.has(id) && Number.isInteger(moves) && (moves as number) >= 1 && (moves as number) <= 1000;

/** Results kept in the browser without an account. */
const readLocal = (): Record<string, number> => {
  const value = store.read();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, moves]) => valid(id, moves))) as Record<string, number>;
};

const writeLocal = (progress: PracticeProgress): void => store.write(Object.keys(progress).length ? progress : null);

/** The fewest moves each position took. */
const best = (a: PracticeProgress, b: PracticeProgress): Record<string, number> => {
  const merged: Record<string, number> = { ...a };
  for (const [id, moves] of Object.entries(b)) merged[id] = Math.min(merged[id] ?? Infinity, moves);
  return merged;
};

/**
 * The practice positions the player finished, with the fewest moves each took: on the account when signed in, in the
 * browser otherwise. Results earned before signing in move to the account the first time a practice page loads with it.
 */
export const usePracticeProgress = () => {
  const { view: progress, setView: setProgress, signedIn } = useAccountSync<Record<string, number>, PracticeProgress>({
    readLocal,
    isEmpty: (local) => Object.keys(local).length === 0,
    guestView: (local) => local,
    upload: (local) => api.post<PracticeProgress>('/api/practice/progress', { results: Object.fromEntries(Object.entries(local).slice(0, PRACTICE_BATCH)) }),
    load: () => api.get<PracticeProgress>('/api/practice/progress'),
    clearLocal: () => writeLocal({}),
  });

  const record = useCallback(
    (id: string, moves: number) => {
      setProgress((current) => best(current ?? {}, { [id]: moves }));
      sendOrKeep(
        signedIn,
        () => api.post('/api/practice/progress', { results: { [id]: moves } }),
        () => writeLocal(best(readLocal(), { [id]: moves })),
      );
    },
    [signedIn],
  );

  return { progress, record };
};
