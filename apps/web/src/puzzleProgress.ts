import { PUZZLE_BATCH } from '@ligungi/protocol';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { api } from './api.ts';
import { session } from './session.ts';
import { useStore } from './store.ts';

const KEY = 'ligungi.puzzlesSolved';
/** Where the mate problems kept what was solved, before they became puzzles. */
const OLD_KEY = 'ligungi.matesSolved';

/** Puzzles solved without an account, kept in the browser; storage may be missing (prerender) or blocked. */
export const readLocalSolved = (): string[] => {
  try {
    const ids = [OLD_KEY, KEY].flatMap((key) => {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    });
    return [...new Set(ids)];
  } catch {
    return [];
  }
};

const writeLocal = (ids: readonly string[]): void => {
  try {
    localStorage.removeItem(OLD_KEY);
    if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids));
    else localStorage.removeItem(KEY);
  } catch {}
};

/**
 * The puzzles the player solved: on the account when signed in, in the browser otherwise. Puzzles solved before
 * signing in move to the account the first time the page loads with it (as solved, without rating). `known` drops ids
 * that no longer exist.
 */
export const useSolvedPuzzles = (known: ReadonlySet<string> | null) => {
  const { user, loaded } = useStore(session);
  const [solved, setSolved] = useState<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (!loaded || !known) return;
    const local = readLocalSolved().filter((id) => known.has(id));
    if (!user) {
      setSolved(new Set(local));
      return;
    }
    let alive = true;
    const request = local.length
      ? api.post<string[]>('/api/puzzles/solved', { ids: local.slice(0, PUZZLE_BATCH) }).then((ids) => {
          writeLocal([]);
          return ids;
        })
      : api.get<string[]>('/api/puzzles/solved');
    request.then((ids) => alive && setSolved(new Set(ids))).catch(() => alive && setSolved(new Set(local)));
    return () => {
      alive = false;
    };
  }, [loaded, user?.id, known]);

  /** Marks a puzzle solved here; with an account the server already recorded it with the try. */
  const markSolved = useCallback(
    (id: string) => {
      setSolved((current) => new Set(current).add(id));
      if (!user) writeLocal([...new Set([...readLocalSolved(), id])]);
    },
    [user?.id],
  );

  return { solved, markSolved };
};
