// The rules of the "play against the computer" form: which opponents can be picked for the chosen
// format. Kept apart from the page so they can be tested.
//
// The player picks the format first (mode and draft), then the opponent. Komugi is offered only for
// the format it plays (Advanced, with the rulebook draft); picking it never changes the format, and
// a game against Komugi is always played by Komugi.

import { initialPosition, type Mode, type Position } from '@ligungi/engine';
import { komugiPlays } from '../../komugi/bridge.ts';

export type Opponent = 'builtin' | 'komugi';

export const OPPONENTS: readonly Opponent[] = ['builtin', 'komugi'];

/** Whether the server has Komugi's network: being looked up, absent or installed. */
export type KomugiModelState = 'loading' | 'missing' | 'installed';

/** Why Komugi cannot be picked: not Advanced, the free draft, or its network not (yet) available. */
export type KomugiUnavailable = 'mode' | 'freeDraft' | 'missing' | 'loading';

export interface ComputerChoices {
  readonly opponent: Opponent;
  readonly mode: Mode;
  readonly freeDraft: boolean;
}

export interface ComputerContext {
  /** The position from `?fen=`, when the game starts from one. */
  readonly custom: Position | null;
  readonly model: KomugiModelState;
}

export interface ComputerForm {
  /** Whether the opponent choice is shown at all: not for a start position Komugi cannot play. */
  readonly komugiShown: boolean;
  /** Why Komugi cannot be picked, or null when it can. */
  readonly komugiUnavailable: KomugiUnavailable | null;
  /** The opponent the game will use: Komugi only when picked and available. */
  readonly opponent: Opponent;
  /** The format, exactly as the player chose it. */
  readonly mode: Mode;
  readonly freeDraft: boolean;
}

/** What the form shows and what the game will be, from the player's choices. */
export const computerForm = (choices: ComputerChoices, context: ComputerContext): ComputerForm => {
  const komugiShown = context.custom === null || komugiPlays(context.custom);
  const komugiUnavailable: KomugiUnavailable | null =
    context.custom === null && choices.mode !== 'advanced'
      ? 'mode'
      : context.custom === null && choices.freeDraft
        ? 'freeDraft'
        : context.model === 'installed'
          ? null
          : context.model;
  return {
    komugiShown,
    komugiUnavailable,
    opponent: choices.opponent === 'komugi' && komugiShown && komugiUnavailable === null ? 'komugi' : 'builtin',
    mode: choices.mode,
    freeDraft: choices.freeDraft,
  };
};

/** Where the game starts: the `?fen=` position, else the start of the form's mode (White always moves first). */
export const computerStart = (form: ComputerForm, custom: Position | null): Position =>
  custom ?? initialPosition(form.mode, 'white', { freeDraft: form.freeDraft });
