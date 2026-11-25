import type { Mode, Outcome, Role } from '@ligungi/engine';
import type { ModeRecord, UserRef } from './index.ts';

/** Bounds of the rating difference groups (opponent minus player) of the insights, lowest first; the last one has none. */
export const OPPONENT_BANDS: readonly (number | null)[] = [-200, -50, 50, 200, null];
export const HELD_GROUPS: readonly (number | null)[] = [2, 5, null];
export type Pace = 'none' | 'clock' | 'correspondence';
export const PACES: readonly Pace[] = ['clock', 'none', 'correspondence'];
export const INSIGHT_OPPONENTS = 5;

/**
 * A player's rated games in one mode, looked at from several sides (`GET /api/users/:name/insights/:mode`). Voided
 * games are left out; at most the latest `RATING_HISTORY_MAX`.
 */
export interface InsightsView {
  readonly mode: Mode;
  readonly games: number;
  /** One record per `OPPONENT_BANDS` group, by how much stronger the opponent was at the start. */
  readonly byOpponent: readonly ModeRecord[];
  /** How the games ended, counted for the wins, the draws and the losses. */
  readonly endings: Readonly<Record<'win' | 'draw' | 'loss', Partial<Record<Outcome['reason'], number>>>>;
  readonly byPace: Readonly<Record<Pace, ModeRecord>>;
  /** Average moves on the board after the draft, by result; `null` without games of that result. */
  readonly length: Readonly<Record<'win' | 'draw' | 'loss', number | null>>;
  /** The most played opponents with an account, most games first. */
  readonly opponents: ReadonlyArray<{ readonly user: UserRef; readonly record: ModeRecord }>;
  /** Draft modes: the pieces the player places on average per game, and the results by pieces still in hand when play starts. */
  readonly draft: {
    readonly placed: Readonly<Partial<Record<Role, number>>>;
    /** One record per `HELD_GROUPS` group. */
    readonly byHeld: readonly ModeRecord[];
  } | null;
}
