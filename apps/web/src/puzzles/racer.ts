import type { RaceGhostView, RacerRecordsView, RacerRef } from '@ligungi/protocol';
import type { Messages } from '../i18n/index.ts';
import { bestScores, type RunRecords } from './puzzleRuns.ts';
import { createStore } from '../core/store.ts';

const GHOSTS_KEY = 'ligungi.racerGhosts';

/** A racer's name: the account's, or "Guest 1234" for a guest. */
export const racerName = (t: Messages, racer: RacerRef): string => (racer.user ? racer.user.name : t.racer.guest(racer.guest ?? 0));

/** A ghost's score `ms` into the race: its last score reached by then. */
export const ghostScore = (ghost: RaceGhostView, ms: number): number => {
  let score = 0;
  for (const [at, value] of ghost.points) {
    if (at > ms) break;
    score = value;
  }
  return score;
};

/** The best race of today and of the last 7 days, in the player's own time zone, and the best ever. */
export const racerRecords = (view: RacerRecordsView, now = Date.now()): RunRecords => bestScores(view.recent, view.best, now);

const readGhosts = (): boolean => {
  try {
    return localStorage.getItem(GHOSTS_KEY) !== 'off';
  } catch {
    return true;
  }
};

/** Whether this browser shows ghosts in races; on unless turned off. */
export const showGhosts = createStore<boolean>(typeof window === 'undefined' ? true : readGhosts());

export const setShowGhosts = (on: boolean): void => {
  showGhosts.set(on);
  try {
    localStorage.setItem(GHOSTS_KEY, on ? 'on' : 'off');
  } catch {
    // The choice then lasts until the page is reloaded.
  }
};
