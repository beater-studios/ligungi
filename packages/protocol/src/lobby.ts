import { MODE_RULES, MODES, type Color, type Mode } from '@ligungi/engine';
import type { ErrorCode } from './errors.ts';
import { BYOYOMI_PERIODS_MAX, BYOYOMI_SECONDS, CORRESPONDENCE_DAYS, type TimeControl } from './time.ts';
import type { Opponent } from './users.ts';

export type ColorChoice = Color | 'random';

export interface GameSettings {
  readonly mode: Mode;
  readonly rated: boolean;
  /** `null` means no clock: casual games only, unless `daysPerMove` makes it a correspondence game. */
  readonly timeControl: TimeControl | null;
  /** Correspondence: days each player has for every move (`CORRESPONDENCE_DAYS`); `null` for games played live. */
  readonly daysPerMove: number | null;
  /** Color of the player who creates the seek or challenge. White always places first in the draft and moves first. */
  readonly color: ColorChoice;
  /**
   * Casual draft modes only: the draft ends when both players declare done, instead of the
   * rulebook rule where the second player's declaration ends it for both.
   */
  readonly freeDraft: boolean;
}

export interface SeekView {
  readonly id: string;
  readonly settings: GameSettings;
  readonly player: Opponent;
  readonly mine: boolean;
  readonly createdAt: number;
}

export interface ChallengeView {
  readonly id: string;
  readonly settings: GameSettings;
  readonly challenger: Opponent;
  /** The player a challenge from a profile is meant for; `null` for an open link anyone can accept. */
  readonly destination: Opponent | null;
  readonly mine: boolean;
  readonly status: 'open' | 'accepted' | 'canceled' | 'declined';
  readonly gameId: string | null;
}

/** Who may challenge a player from their profile. */
export const CHALLENGE_POLICIES = ['everyone', 'following', 'nobody'] as const;
export type ChallengePolicy = (typeof CHALLENGE_POLICIES)[number];

export interface LobbyView {
  readonly seeks: readonly SeekView[];
  readonly playing: number;
  readonly online: number;
}

const COLOR_CHOICES: readonly string[] = ['white', 'black', 'random'];

/** Validates user input for a new game. Returns an error code when invalid. */
export const parseSettings = (input: unknown): GameSettings | ErrorCode => {
  if (typeof input !== 'object' || input === null) return 'invalidSettings';
  const value = input as Record<string, unknown>;
  if (!(MODES as readonly unknown[]).includes(value.mode)) return 'invalidMode';
  if (typeof value.rated !== 'boolean') return 'invalidRated';
  if (!COLOR_CHOICES.includes(value.color as string)) return 'invalidColor';
  let timeControl: TimeControl | null = null;
  if (value.timeControl !== null) {
    const tc = value.timeControl as Record<string, unknown> | undefined;
    const initial = Number(tc?.initial);
    const increment = Number(tc?.increment);
    const byoyomi = tc?.byoyomi === undefined ? 0 : Number(tc.byoyomi);
    if (byoyomi !== 0) {
      // Byo-yomi: the main time may be zero, there is no increment, and the periods are counted.
      const periods = Number(tc?.periods);
      if (!BYOYOMI_SECONDS.includes(byoyomi) || !Number.isInteger(periods) || periods < 1 || periods > BYOYOMI_PERIODS_MAX || increment !== 0) {
        return 'invalidByoyomi';
      }
      if (!Number.isInteger(initial) || initial < 0 || initial > 3 * 3600) return 'invalidInitialTime';
      timeControl = { initial, increment: 0, byoyomi, periods };
    } else {
      if (!Number.isInteger(initial) || initial < 60 || initial > 3 * 3600) return 'invalidInitialTime';
      if (!Number.isInteger(increment) || increment < 0 || increment > 180) return 'invalidIncrement';
      timeControl = { initial, increment };
    }
  }
  let daysPerMove: number | null = null;
  if (value.daysPerMove !== undefined && value.daysPerMove !== null) {
    if (timeControl || !CORRESPONDENCE_DAYS.includes(value.daysPerMove as number)) return 'invalidDaysPerMove';
    daysPerMove = value.daysPerMove as number;
  }
  if (value.rated && !timeControl && !daysPerMove) return 'unlimitedNotRated';
  if (value.freeDraft !== undefined && typeof value.freeDraft !== 'boolean') return 'invalidDraftOption';
  const freeDraft = value.freeDraft === true && MODE_RULES[value.mode as Mode].draft;
  if (value.rated && freeDraft) return 'ratedNeedsOfficialDraft';
  return {
    mode: value.mode as Mode,
    rated: value.rated,
    timeControl,
    daysPerMove,
    color: value.color as ColorChoice,
    freeDraft,
  };
};
