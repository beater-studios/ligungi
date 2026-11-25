import { PUZZLE_BATCH } from '@ligungi/protocol';
import { useCallback } from 'preact/hooks';
import { api } from '../core/api.ts';
import { localJson, useAccountSync } from '../syncedProgress.ts';

const store = localJson('ligungi.puzzlesSolved');
/** Where the mate problems kept what was solved, before they became puzzles. */
const oldStore = localJson('ligungi.matesSolved');

const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);

/** Puzzles solved without an account, kept in the browser. */
export const readLocalSolved = (): string[] => [...new Set([...ids(oldStore.read()), ...ids(store.read())])];

const writeLocal = (solved: readonly string[]): void => {
  oldStore.write(null);
  store.write(solved.length ? solved : null);
};

/**
 * The puzzles the player solved: on the account when signed in, in the browser otherwise. Puzzles solved before
 * signing in move to the account the first time the page loads with it (as solved, without rating). `known` drops ids
 * that no longer exist.
 */
export const useSolvedPuzzles = (known: ReadonlySet<string> | null) => {
  const { view: solved, setView: setSolved, signedIn } = useAccountSync<string[], ReadonlySet<string>>(
    {
      ready: known !== null,
      readLocal: () => readLocalSolved().filter((id) => known?.has(id)),
      isEmpty: (local) => local.length === 0,
      guestView: (local) => new Set(local),
      upload: (local) => api.post<string[]>('/api/puzzles/solved', { ids: local.slice(0, PUZZLE_BATCH) }).then((saved) => new Set(saved)),
      load: () => api.get<string[]>('/api/puzzles/solved').then((saved) => new Set(saved)),
      clearLocal: () => writeLocal([]),
    },
    [known],
  );

  /** Marks a puzzle solved here; with an account the server already recorded it with the try. */
  const markSolved = useCallback(
    (id: string) => {
      setSolved((current) => new Set(current).add(id));
      if (!signedIn) writeLocal([...new Set([...readLocalSolved(), id])]);
    },
    [signedIn],
  );

  return { solved, markSolved };
};
