import { pieceName, type PieceNames } from '@ligungi/board';
import { moveToRulebook, moveToString, rulebookParts, type Move, type Position } from '@ligungi/engine';
import { usePieceNames, useT, type Messages } from './i18n/index.ts';
import { prefs } from './prefs.ts';
import { useStore } from './store.ts';

export type Notation = 'rulebook' | 'named' | 'machine';

/**
 * A move in the chosen notation. `named` is the rulebook's "column-row-level" with the piece name instead of the
 * kanji and short marks so the move list stays narrow: `+` from the hand, `×` capture, `⇄` betrayal.
 */
export const moveText = (notation: Notation, position: Position, move: Move, t: Messages, names: PieceNames): string => {
  if (notation === 'machine') return moveToString(move);
  if (notation === 'rulebook') return moveToRulebook(position, move);
  const parts = rulebookParts(position, move);
  if (parts.done) return t.done;
  const marks = `${parts.capture ? ' ×' : ''}${parts.betray ? ' ⇄' : ''}`;
  return `${parts.column}-${parts.row}-${parts.level} ${parts.drop ? '+' : ''}${pieceName(parts.role, names)}${marks}`;
};

/** `moveText` bound to the viewer's notation, language and piece names. */
export const useMoveText = (): ((position: Position, move: Move) => string) => {
  const { notation } = useStore(prefs);
  const t = useT();
  const names = usePieceNames();
  return (position, move) => moveText(notation, position, move, t, names);
};
