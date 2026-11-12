import { BOARD_SIZE, squareAt } from './board.ts';
import { emptyBoard, emptyHand } from './position.ts';
import { ROLE_INFO, roleFromLetter } from './roles.ts';
import {
  COLORS,
  MODES,
  ROLES,
  type Color,
  type Mode,
  type Piece,
  type Position,
  type Role,
  type Tower,
} from './types.ts';

/**
 * Position string: `<board> <turn> <hands> <mode> <phase> <first>`.
 *
 * - board: ranks from 9 (Black's back rank) to 1, separated by `/`, files a..i. Digits count empty
 *   squares, a letter is a single piece (uppercase White, lowercase Black) and a tower of two or
 *   more is written bottom to top inside parentheses, e.g. `(pA)`.
 * - turn: `w` or `b`.
 * - hands: counts before letters, White uppercase then Black lowercase, e.g. `2J2NP2j2np`, or `-`.
 * - mode: `intro`, `beginner`, `intermediate` or `advanced`.
 * - phase: `p` (play), or `d` (draft) followed by the colors that declared done, e.g. `dw`. A
 *   trailing `+` marks the free draft option, e.g. `d+` (see `Position.freeDraft`).
 * - first: `w` or `b`, the first player of the game.
 */
export const INITIAL_DRAFT_FEN =
  '9/9/9/9/9/9/9/9/9 w MGL2J2S3N2R2Y2F4PC2AKTmgl2j2s3n2r2y2f4pc2akt advanced d w';

const pieceLetter = (piece: Piece): string => {
  const letter = ROLE_INFO[piece.role].letter;
  return piece.color === 'white' ? letter : letter.toLowerCase();
};

const towerText = (tower: Tower): string => {
  const letters = tower.map(pieceLetter).join('');
  return tower.length > 1 ? `(${letters})` : letters;
};

export const toFen = (position: Position): string => {
  const ranks: string[] = [];
  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    let text = '';
    let empty = 0;
    for (let file = 0; file < BOARD_SIZE; file++) {
      const tower = position.board[squareAt(file, rank)]!;
      if (tower.length === 0) {
        empty++;
        continue;
      }
      if (empty) text += String(empty);
      empty = 0;
      text += towerText(tower);
    }
    if (empty) text += String(empty);
    ranks.push(text);
  }
  let hands = '';
  for (const color of COLORS) {
    for (const role of ROLES) {
      const count = position.hands[color][role];
      if (count === 0) continue;
      hands += (count > 1 ? String(count) : '') + pieceLetter({ role, color });
    }
  }
  const phase =
    position.phase === 'play'
      ? 'p'
      : `d${position.draftDone.white ? 'w' : ''}${position.draftDone.black ? 'b' : ''}`;
  const phaseText = `${phase}${position.freeDraft ? '+' : ''}`;
  const letter = (color: Color) => (color === 'white' ? 'w' : 'b');
  return [ranks.join('/'), letter(position.turn), hands || '-', position.mode, phaseText, letter(position.firstPlayer)].join(' ');
};

const parsePiece = (letter: string): Piece | undefined => {
  const role = roleFromLetter(letter);
  if (!role) return undefined;
  return { role, color: letter === letter.toUpperCase() ? 'white' : 'black' };
};

export class FenError extends Error {}

export const parseFen = (fen: string): Position => {
  const [boardText, turnText, handText, modeText, phaseText, firstText] = fen.trim().split(/\s+/);
  if (!boardText || !turnText || !handText || !modeText || !phaseText || !firstText) {
    throw new FenError('Expected 6 fields');
  }
  if (firstText !== 'w' && firstText !== 'b') throw new FenError('Bad first player');
  const rankTexts = boardText.split('/');
  if (rankTexts.length !== BOARD_SIZE) throw new FenError('Expected 9 ranks');
  const board = emptyBoard();
  rankTexts.forEach((text, index) => {
    const rank = BOARD_SIZE - 1 - index;
    let file = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i]!;
      if (/[1-9]/.test(char)) {
        file += Number(char);
        continue;
      }
      const letters = char === '(' ? text.slice(i + 1, text.indexOf(')', i)) : char;
      if (char === '(') i += letters.length + 1;
      const tower = [...letters].map((letter) => {
        const piece = parsePiece(letter);
        if (!piece) throw new FenError(`Unknown piece ${letter}`);
        return piece;
      });
      if (tower.length === 0 || file >= BOARD_SIZE) throw new FenError(`Bad rank ${text}`);
      board[squareAt(file, rank)] = tower;
      file++;
    }
    if (file !== BOARD_SIZE) throw new FenError(`Bad rank ${text}`);
  });

  if (turnText !== 'w' && turnText !== 'b') throw new FenError('Bad turn');
  const hands: Record<Color, Record<Role, number>> = { white: emptyHand(), black: emptyHand() };
  if (handText !== '-') {
    for (const [, count, letter] of handText.matchAll(/(\d*)([A-Za-z])/g)) {
      const piece = parsePiece(letter!);
      if (!piece) throw new FenError(`Unknown piece ${letter}`);
      hands[piece.color][piece.role] += count ? Number(count) : 1;
    }
  }
  if (!(MODES as readonly string[]).includes(modeText)) throw new FenError('Bad mode');
  if (!/^(p|dw?b?)\+?$/.test(phaseText)) throw new FenError('Bad phase');
  const play = phaseText.startsWith('p');

  return {
    mode: modeText as Mode,
    phase: play ? 'play' : 'draft',
    board,
    hands,
    turn: turnText === 'w' ? 'white' : 'black',
    firstPlayer: firstText === 'w' ? 'white' : 'black',
    freeDraft: phaseText.endsWith('+'),
    draftDone:
      play
        ? { white: true, black: true }
        : { white: phaseText.includes('w'), black: phaseText.includes('b') },
  };
};

/** Board, hands and side to move: the identity used for repetition. */
export const repetitionKey = (position: Position): string => toFen(position).split(' ').slice(0, 3).join(' ');
