import { handSize } from './position.ts';
import { opposite, type Color, type Move, type Piece, type Position, type Role } from './types.ts';

/** Applies a move without validating it. Use `legalMoves` or `Game` to validate. */
export const applyMove = (position: Position, move: Move): Position => {
  const color = position.turn;
  const board = position.board.slice();
  const hands: Record<Color, Record<Role, number>> = {
    white: { ...position.hands.white },
    black: { ...position.hands.black },
  };
  const draftDone = { ...position.draftDone };
  const hand = hands[color];

  const land = (to: number, piece: Piece, betray: readonly number[] | undefined): void => {
    const tower = board[to]!.slice();
    for (const level of betray ?? []) {
      const role = tower[level]!.role;
      hand[role]--;
      tower[level] = { role, color };
    }
    tower.push(piece);
    board[to] = tower;
  };

  if (move.kind === 'move') {
    const origin = board[move.from]!.slice();
    const piece = origin.pop()!;
    board[move.from] = origin;
    if (move.action === 'move') board[move.to] = [piece];
    else if (move.action === 'capture')
      board[move.to] = [...board[move.to]!.filter((p) => p.color === color), piece];
    else land(move.to, piece, move.betray);
  } else if (move.kind === 'drop') {
    hand[move.role]--;
    land(move.to, { role: move.role, color }, move.betray);
  } else {
    draftDone[color] = true;
  }

  if (position.phase === 'play') {
    return { ...position, board, hands, draftDone, turn: opposite(color) };
  }

  if (handSize(hand) === 0) draftDone[color] = true;
  const secondPlayer = opposite(position.firstPlayer);
  const finished = position.freeDraft ? draftDone.white && draftDone.black : draftDone[secondPlayer];
  if (finished) {
    return {
      ...position,
      phase: 'play',
      board,
      hands,
      draftDone: { white: true, black: true },
      turn: position.firstPlayer,
    };
  }
  const turn = draftDone[opposite(color)] ? color : opposite(color);
  return { ...position, board, hands, draftDone, turn };
};
