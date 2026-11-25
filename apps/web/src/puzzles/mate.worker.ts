import { isForcedMate, longestDefense } from '@ligungi/bot';
import { applyMove, isMarshalAttacked, moveToString, opposite, parseFen, parseMove } from '@ligungi/engine';

interface Request {
  readonly id: number;
  /** The position before the attacker's move. */
  readonly fen: string;
  readonly move: string;
  /** Attacker moves left to mate, this one included. */
  readonly moves: number;
}

/**
 * Checks a solver's move off the stored solution line: it must attack the Marshal and still force mate in the moves
 * left. Answers with the longest defense when the problem goes on.
 */
self.onmessage = (event: MessageEvent<Request>) => {
  const { id, fen, move, moves } = event.data;
  const position = parseFen(fen);
  const parsed = parseMove(move);
  if (!parsed) return self.postMessage({ id, check: false, ok: false, defense: null });
  const next = applyMove(position, parsed);
  const check = isMarshalAttacked(next, opposite(position.turn));
  const ok = check && isForcedMate(next, moves - 1);
  const defense = ok && moves > 1 ? longestDefense(next, moves - 1) : null;
  self.postMessage({ id, check, ok, defense: defense ? moveToString(defense) : null });
};
