import { PRACTICE_BATCH, PRACTICE_POSITIONS } from '@ligungi/protocol';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.ts';
import { session } from './session.ts';
import { useStore } from './store.ts';

const KEY = 'ligungi.practice';
const KNOWN: ReadonlySet<string> = new Set(PRACTICE_POSITIONS.map((position) => position.id));

export type PracticeProgress = Readonly<Record<string, number>>;

const valid = (id: string, moves: unknown): moves is number =>
  KNOWN.has(id) && Number.isInteger(moves) && (moves as number) >= 1 && (moves as number) <= 1000;

/** Results kept in the browser without an account; storage may be missing (prerender) or blocked. */
const readLocal = (): Record<string, number> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, moves]) => valid(id, moves))) as Record<string, number>;
  } catch {
    return {};
  }
};

const writeLocal = (progress: PracticeProgress): void => {
  try {
    if (Object.keys(progress).length) localStorage.setItem(KEY, JSON.stringify(progress));
    else localStorage.removeItem(KEY);
  } catch {}
};

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
  const { user, loaded } = useStore(session);
  const [progress, setProgress] = useState<PracticeProgress | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const local = readLocal();
    if (!user) {
      setProgress(local);
      return;
    }
    let alive = true;
    const pending = Object.entries(local).slice(0, PRACTICE_BATCH);
    const request = pending.length
      ? api.post<PracticeProgress>('/api/practice/progress', { results: Object.fromEntries(pending) }).then((saved) => {
          writeLocal({});
          return saved;
        })
      : api.get<PracticeProgress>('/api/practice/progress');
    request.then((saved) => alive && setProgress(saved)).catch(() => alive && setProgress(local));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id]);

  const record = useCallback(
    (id: string, moves: number) => {
      setProgress((current) => best(current ?? {}, { [id]: moves }));
      if (user) api.post('/api/practice/progress', { results: { [id]: moves } }).catch(() => {});
      else writeLocal(best(readLocal(), { [id]: moves }));
    },
    [user?.id],
  );

  return { progress, record };
};
