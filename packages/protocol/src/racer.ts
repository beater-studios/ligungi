import { stormBonus } from './puzzles.ts';

/**
 * Puzzle Racer, as on lichess: everyone in a race gets the same puzzles, getting harder, for 90 seconds. Each correct
 * move scores a point, a wrong one moves on to the next puzzle, and long combos of correct moves score extra points.
 */
export const RACE_TIME_MS = 90_000;
export const RACE_MAX_PLAYERS = 10;
/** A public race starts this long after its first player joins, so others can join it. */
export const RACE_PUBLIC_WAIT_MS = 15_000;
/** The countdown once a public race is full, or once the creator of a private race presses Start. */
export const RACE_COUNTDOWN_MS = 5_000;
/** Past players shown racing alongside a public race that reuses their puzzles. */
export const RACE_MAX_GHOSTS = 4;

/** Extra points a combo of correct moves scores when it reaches `combo`: one at each of Storm's combo marks. */
export const racerBonus = (combo: number): number => (stormBonus(combo) > 0 ? 1 : 0);

/** `public`: anyone joins from the Racer page. `friends`: through its link. `call`: the people of a Discord Activity call. */
export type RaceKind = 'public' | 'friends' | 'call';
/** `waiting`: a private race before its creator starts it. `countdown`: the start time is set. */
export type RaceStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

/** Who races: an account, or a guest shown by a number drawn for the race. */
export interface RacerRef {
  readonly name: string;
  readonly user: { readonly id: string; readonly name: string } | null;
  readonly guest: number | null;
}

export interface RacePlayerView extends RacerRef {
  readonly score: number;
  readonly me: boolean;
}

/** A player of an earlier race over the same puzzles: their score along the race, as `[ms from the start, score]`. */
export interface RaceGhostView extends RacerRef {
  readonly points: readonly (readonly [number, number])[];
}

/** The viewer's own progress, when they race in it. */
export interface RaceSelfView {
  /** The puzzle they are on, in `puzzles`. */
  readonly index: number;
  readonly score: number;
  readonly combo: number;
  readonly skipUsed: boolean;
}

export interface RaceView {
  readonly id: string;
  readonly kind: RaceKind;
  readonly status: RaceStatus;
  /** Whether the viewer created it and so may start it (private races). */
  readonly owner: boolean;
  /** Milliseconds from when the server sent this view: until the start, and until the end. */
  readonly startsIn: number | null;
  readonly endsIn: number | null;
  /** Puzzle ids, in order; sent once the start time is set. */
  readonly puzzles: readonly string[] | null;
  readonly players: readonly RacePlayerView[];
  readonly ghosts: readonly RaceGhostView[];
  readonly you: RaceSelfView | null;
}

/** The viewer's race scores of the last days (`PUZZLE_RUN_RECENT_MS`), for the best of today and of the week, and their best ever. */
export interface RacerRecordsView {
  readonly recent: readonly { readonly score: number; readonly at: number }[];
  readonly best: number;
}

export interface RacerLobbyView {
  /** Only with an account; a guest's races are not kept. */
  readonly records: RacerRecordsView | null;
  /** Players waiting in the open public race, if there is one. */
  readonly waiting: number;
}
