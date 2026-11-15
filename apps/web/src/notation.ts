import { pieceName, pieceShortName, type PieceNames } from '@ligungi/board';
import { moveToRulebook, moveToString, rulebookParts, type Move, type Position } from '@ligungi/engine';
import { usePieceNames, useT, type Messages } from './i18n/index.ts';
import { prefs } from './prefs.ts';
import { useStore } from './store.ts';

export type Notation = 'rulebook' | 'named' | 'machine';

/**
 * A move in the chosen notation. `named` is the rulebook's "column-row-level" with the piece name instead of the
 * kanji and short marks before it: `+` from the hand, `×` capture, `⇄` betrayal. `short` abbreviates the long names,
 * for the move lists, where the marks also stay visible if the end is cut.
 */
export const moveText = (notation: Notation, position: Position, move: Move, t: Messages, names: PieceNames, short = false): string => {
  if (notation === 'machine') return moveToString(move);
  if (notation === 'rulebook') return moveToRulebook(position, move);
  const parts = rulebookParts(position, move);
  if (parts.done) return t.done;
  const marks = `${parts.drop ? '+' : ''}${parts.capture ? '×' : ''}${parts.betray ? '⇄' : ''}`;
  const name = short ? pieceShortName(parts.role, names) : pieceName(parts.role, names);
  return `${parts.column}-${parts.row}-${parts.level} ${marks}${name}`;
};

/** A move as a move list shows it: the abbreviated text, and the full one when it differs (for hover and screen readers). */
export interface ListedMove {
  readonly text: string;
  readonly full: string | undefined;
}

/** Moves for the move lists, in the viewer's notation, language and piece names. */
export const useMoveText = (): ((position: Position, move: Move) => ListedMove) => {
  const { notation } = useStore(prefs);
  const t = useT();
  const names = usePieceNames();
  return (position, move) => {
    const text = moveText(notation, position, move, t, names, true);
    const full = moveText(notation, position, move, t, names);
    return { text, full: full === text ? undefined : full };
  };
};
