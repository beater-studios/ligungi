import { applyMove, isMarshalAttacked, legalMoves, opposite, type Move, type Position } from '@ligungi/engine';

/**
 * Mate search for the mate problems, with the tsume convention: every move of the attacking side attacks the opposing
 * Marshal. A side with no legal move loses (docs/rules.md, section 9), so the defender is mated once it has no reply.
 * Depths count the attacker's moves only: mate in 2 is attacker, defender, attacker.
 */

/** The attacker's checking moves, each with the position it leads to. */
export const checkingMoves = (position: Position): Array<{ move: Move; next: Position }> => {
  const checks: Array<{ move: Move; next: Position }> = [];
  for (const move of legalMoves(position)) {
    const next = applyMove(position, move);
    if (isMarshalAttacked(next, opposite(position.turn))) checks.push({ move, next });
  }
  return checks;
};

/** With the defender to move: whether the attacker mates within `moves` more checking moves, whatever the defense. */
export const isForcedMate = (position: Position, moves: number): boolean => {
  const replies = legalMoves(position);
  if (replies.length === 0) return true;
  if (moves === 0) return false;
  return replies.every((reply) => matesWithin(applyMove(position, reply), moves));
};

/** With the attacker to move: whether some checking move forces mate within `moves` attacker moves. */
export const matesWithin = (position: Position, moves: number): boolean =>
  checkingMoves(position).some(({ next }) => isForcedMate(next, moves - 1));

/** With the attacker to move: every checking move that forces mate within `moves` attacker moves. */
export const mateSolutions = (position: Position, moves: number): Move[] =>
  checkingMoves(position)
    .filter(({ next }) => isForcedMate(next, moves - 1))
    .map(({ move }) => move);

/** With the attacker to move: the fewest attacker moves that force mate, up to `max`; `null` beyond it. */
export const mateDistance = (position: Position, max: number): number | null => {
  for (let moves = 1; moves <= max; moves++) if (matesWithin(position, moves)) return moves;
  return null;
};

/**
 * With the defender to move, mated within `moves` attacker moves whatever it does: the reply that holds out longest.
 * Among equally long defenses, the first one in move order, so the same position always gets the same answer.
 * `null` when the defender has no reply (it is mated).
 */
export const longestDefense = (position: Position, moves: number): Move | null => {
  let best: Move | null = null;
  let bestDistance = -1;
  for (const reply of legalMoves(position)) {
    const distance = mateDistance(applyMove(position, reply), moves) ?? moves + 1;
    if (distance > bestDistance) {
      best = reply;
      bestDistance = distance;
    }
  }
  return best;
};
