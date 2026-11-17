import { pieceName, type PieceNames } from '@ligungi/board';
import {
  COLORS,
  ROLES,
  ROLE_INFO,
  SQUARES,
  fromRulebook,
  isMarshalAttacked,
  legalMoves,
  moveToRulebook,
  moveToString,
  parseMove,
  parseSquare,
  rulebookParts,
  toRulebook,
  topOf,
  type Color,
  type Move,
  type Piece,
  type Position,
  type Role,
  type Square,
} from '@ligungi/engine';
import { SHAPE_COLORS, type ShapeColor, type StudyShape } from '@ligungi/protocol';
import type { Messages } from './i18n/index.ts';

/**
 * Text for the screen reader mode: moves, squares, towers and hands described in words, and what a player types turned
 * into a move or a question. Squares are always spoken in the rulebook's column-row form.
 */
export interface Speaker {
  readonly t: Messages;
  readonly names: PieceNames;
}

export const squareText = (square: Square): string => {
  const { column, row } = toRulebook(square);
  return `${column}-${row}`;
};

const name = (s: Speaker, role: Role): string => pieceName(role, s.names);
const pieceText = (s: Speaker, piece: Piece): string => s.t.blind.piece(name(s, piece.role), piece.color);

/** A tower read from the top down: "Samurai of Black, over Soldier of White". */
const below = (s: Speaker, pieces: readonly Piece[]): string => s.t.blind.list([...pieces].reverse().map((piece) => pieceText(s, piece)));

/** Needs the position before the move. */
export const describeMove = (s: Speaker, before: Position, move: Move): string => {
  const b = s.t.blind;
  const color = before.turn;
  if (move.kind === 'done') return b.done(color);
  const target = before.board[move.to]!;
  const parts = rulebookParts(before, move);
  const level = parts.done ? 1 : parts.level;
  let text: string;
  if (move.kind === 'drop') text = b.drop(color, name(s, move.role), squareText(move.to), level);
  else {
    const mover = topOf(before.board[move.from]!)!;
    const from = squareText(move.from);
    const to = squareText(move.to);
    if (move.action === 'stack') text = b.stack(color, name(s, mover.role), from, to, pieceText(s, topOf(target)!), level);
    else if (move.action === 'capture') {
      const captured = target.filter((piece) => piece.color !== color);
      text = b.capture(color, name(s, mover.role), from, to, below(s, captured), captured.length);
    } else text = b.move(color, name(s, mover.role), from, to);
  }
  if (move.betray?.length) {
    const turned = move.betray.map((index) => b.atLevel(pieceText(s, target[index]!), index + 1));
    text += ` ${b.betray(b.list(turned), turned.length, color)}`;
  }
  return text;
};

/** What a move changed beyond itself: the end of the draft, a Marshal under attack. */
export const moveNotes = (s: Speaker, before: Position, after: Position): string[] => {
  const notes: string[] = [];
  if (before.phase === 'draft' && after.phase === 'play') notes.push(s.t.blind.draftOver);
  if (after.phase === 'play' && isMarshalAttacked(after, after.turn)) notes.push(s.t.blind.check(after.turn));
  return notes;
};

export const describeSquare = (s: Speaker, position: Position, square: Square): string => {
  const b = s.t.blind;
  const tower = position.board[square]!;
  if (tower.length === 0) return b.emptySquare(squareText(square));
  if (tower.length === 1) return b.square(squareText(square), pieceText(s, tower[0]!));
  return b.tower(squareText(square), tower.length, b.list(tower.map((piece, index) => b.level(index + 1, pieceText(s, piece)))));
};

export const describeHands = (s: Speaker, position: Position): string =>
  COLORS.map((color) => {
    const hand = position.hands[color];
    const pieces = ROLES.filter((role) => hand[role] > 0).map((role) => s.t.blind.handPiece(name(s, role), hand[role]));
    return pieces.length ? s.t.blind.hand(color, s.t.blind.list(pieces)) : s.t.blind.emptyHand(color);
  }).join(' ');

/** The whole position: whose turn it is, each side's pieces on top of a square with what lies under them, and the hands. */
export const describePosition = (s: Speaker, position: Position): string => {
  const b = s.t.blind;
  const lines = [b.turn(position.turn, position.phase === 'draft')];
  if (position.phase === 'draft') for (const color of COLORS) if (position.draftDone[color]) lines.push(b.draftDone(color));
  for (const color of COLORS) {
    const entries = SQUARES.filter((square) => topOf(position.board[square]!)?.color === color).map((square) => {
      const tower = position.board[square]!;
      const top = b.onSquare(name(s, tower[tower.length - 1]!.role), squareText(square));
      return tower.length > 1 ? `${top}, ${b.over(below(s, tower.slice(0, -1)))}` : top;
    });
    lines.push(entries.length ? b.side(color, entries.join('; ')) : b.noPieces(color));
  }
  lines.push(describeHands(s, position));
  return lines.join(' ');
};

/** Where the piece on top of a square can go, by action. The side not to move is asked as if it were its turn. */
export const describeReach = (s: Speaker, position: Position, square: Square): string => {
  const b = s.t.blind;
  const piece = topOf(position.board[square]!);
  if (!piece) return b.emptySquare(squareText(square));
  if (position.phase === 'draft') return b.noMovesDraft;
  const asked = position.turn === piece.color ? position : { ...position, turn: piece.color };
  const moves = legalMoves(asked).filter((move): move is Extract<Move, { kind: 'move' }> => move.kind === 'move' && move.from === square);
  const squaresFor = (action: 'move' | 'stack' | 'capture') => [...new Set(moves.filter((move) => move.action === action).map((move) => move.to))].map(squareText);
  const parts = [
    [squaresFor('move'), b.moveTo],
    [squaresFor('stack'), b.stackOn],
    [squaresFor('capture'), b.captureOn],
  ] as const;
  const said = parts.filter(([squares]) => squares.length > 0).map(([squares, phrase]) => phrase(b.list(squares)));
  const who = pieceText(s, piece);
  return said.length ? b.reach(who, squareText(square), said.join('; ')) : b.noMoves(who, squareText(square));
};

export type Command =
  | { readonly kind: 'position' | 'hands' | 'last' | 'clocks' | 'help' | 'done' | 'draw' | 'resign' | 'goal' | 'prev' | 'next' | 'first' | 'end' }
  | { readonly kind: 'square' | 'reach'; readonly square: Square }
  | { readonly kind: 'pick'; readonly index: number }
  | { readonly kind: 'move'; readonly text: string };

/** Lowercase, without accents, with the hyphen of compound names ("Tenente-General") as a space. */
export const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\p{L})-(?=\p{L})/gu, '$1 ')
    .replace(/[.,;!]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();

type Words = Messages['blind']['words'];

/** The English words work in every language, beside the short letters. */
const BASE_WORDS: Readonly<Record<keyof Words, readonly string[]>> = {
  position: ['p', 'position'],
  square: ['c', 'square'],
  hands: ['m', 'hands', 'hand'],
  reach: ['l', 'moves'],
  last: ['u', 'last'],
  clocks: ['r', 'clock', 'clocks'],
  help: ['h', 'help', '?'],
  goal: ['g', 'goal'],
  prev: ['<', 'prev', 'back'],
  next: ['>', 'next'],
  first: ['first', 'start'],
  end: ['end'],
  done: ['done'],
  draw: ['draw'],
  resign: ['resign'],
  capture: ['capture', 'x'],
  stack: ['stack', '='],
  betray: ['betray'],
  drop: ['drop', 'new', '+'],
  arrow: ['arrow'],
  paint: ['paint'],
  clear: ['clear'],
  drawings: ['d', 'drawings'],
  remove: ['remove'],
  turn: ['turn'],
  variation: ['v', 'variation'],
};

/** Words people put between squares and names ("samurai from 6-7 to 6-6"), skipped in any language. */
const FILLERS = new Set(['to', 'from', 'on', 'de', 'do', 'da', 'para', 'em', 'no', 'na', 'a', 'al', 'del', 'en', 'desde', 'hasta']);

export const isWord = (s: Speaker, key: keyof Words, token: string): boolean => BASE_WORDS[key].includes(token) || s.t.blind.words[key].some((word) => normalize(word) === token);

/** A square written as the rulebook's column-row (with an optional tier) or in the machine notation's letters. */
export const readSquare = (token: string): { square: Square; level?: number } | null => {
  const rulebook = /^([1-9])-([1-9])(?:-([1-3]))?$/.exec(token);
  if (rulebook) {
    const square = fromRulebook(Number(rulebook[1]), Number(rulebook[2]));
    return rulebook[3] ? { square, level: Number(rulebook[3]) } : { square };
  }
  const square = /^[a-i][1-9]$/.test(token) ? parseSquare(token) : undefined;
  return square === undefined ? null : { square };
};

export const parseCommand = (s: Speaker, input: string): Command | null => {
  const text = normalize(input);
  if (!text) return null;
  if (/^\d+$/.test(text)) return { kind: 'pick', index: Number(text) };
  const [first = '', ...rest] = text.split(' ');
  const simple = ['position', 'hands', 'last', 'clocks', 'help', 'done', 'draw', 'resign', 'goal', 'prev', 'next', 'first', 'end'] as const;
  if (rest.length === 0) for (const kind of simple) if (isWord(s, kind, first)) return { kind };
  if (rest.length === 1) {
    const target = readSquare(rest[0]!);
    if (target && isWord(s, 'square', first)) return { kind: 'square', square: target.square };
    if (target && isWord(s, 'reach', first)) return { kind: 'reach', square: target.square };
  }
  return { kind: 'move', text: input.trim() };
};

const NAME_SETS: readonly PieceNames[] = ['pt', 'en', 'es', 'ja'];

/** Every way a piece can be named, normalized, longest first so "tenente general" is found before "general". */
const PIECE_WORDS: ReadonlyArray<readonly [string, Role]> = ROLES.flatMap((role) => [
  ...NAME_SETS.map((set) => [normalize(pieceName(role, set)), role] as const),
  [ROLE_INFO[role].kanji, role] as const,
]).sort((a, b) => b[0].length - a[0].length);

/** The rulebook notation with the piece name instead of the kanji, without the marks: "6-6-1 samurai". */
const namedText = (position: Position, move: Move, names: PieceNames): string => {
  const parts = rulebookParts(position, move);
  return parts.done ? '' : normalize(`${parts.column}-${parts.row}-${parts.level} ${pieceName(parts.role, names)}`);
};

const roleOfMove = (position: Position, move: Move): Role | null =>
  move.kind === 'done' ? null : move.kind === 'drop' ? move.role : (topOf(position.board[move.from]!)?.role ?? null);

/**
 * The legal moves that match what was typed: the machine notation, the rulebook notation (also with piece names), or a
 * free form of squares, a piece name and action words in any order. `null` when the text cannot be read at all.
 */
export const matchMoves = (s: Speaker, position: Position, legal: readonly Move[], input: string): Move[] | null => {
  const raw = input.trim();
  const machine = parseMove(raw);
  if (machine) {
    const exact = legal.filter((move) => moveToString(move) === moveToString(machine));
    // "e2f3" without the `=` or `x` of the action: any action between those squares, listed when there are several.
    if (exact.length || machine.kind !== 'move' || machine.action !== 'move' || machine.betray) return exact;
    return legal.filter((move) => move.kind === 'move' && move.from === machine.from && move.to === machine.to);
  }
  const text = normalize(raw);
  const written = legal.filter(
    (move) =>
      normalize(moveToRulebook(position, move)) === text ||
      namedText(position, move, s.names) === text ||
      namedText(position, move, 'ja') === text,
  );
  if (written.length) return written;

  let rest = ` ${text} `;
  const roles = new Set<Role>();
  for (const [word, role] of PIECE_WORDS) {
    const kanji = word.length === 1;
    const pattern = kanji ? word : ` ${word} `;
    if (rest.includes(pattern)) {
      roles.add(role);
      rest = rest.replace(pattern, ' ');
    }
  }
  const squares: Array<{ square: Square; level?: number }> = [];
  let action: 'move' | 'stack' | 'capture' | null = null;
  let drop = false;
  let betray = false;
  for (const token of rest.split(' ').filter(Boolean)) {
    const square = readSquare(token);
    if (square) squares.push(square);
    else if (FILLERS.has(token)) continue;
    else if (isWord(s, 'capture', token)) action = 'capture';
    else if (isWord(s, 'stack', token)) action = 'stack';
    else if (isWord(s, 'drop', token)) drop = true;
    else if (isWord(s, 'betray', token)) betray = true;
    else {
      // A piece name cut short: a unique start of any of its names ("sam", "lanc").
      const found = new Set(PIECE_WORDS.filter(([word]) => token.length >= 3 && word.split(' ').some((part) => part.startsWith(token))).map(([, role]) => role));
      if (found.size !== 1) return null;
      roles.add([...found][0]!);
    }
  }
  if (squares.length === 0 || squares.length > 2 || roles.size > 1) return null;
  const to = squares[squares.length - 1]!;
  const from = squares.length === 2 ? squares[0]!.square : null;
  const role = [...roles][0] ?? null;
  return legal.filter((move) => {
    if (move.kind === 'done' || move.to !== to.square) return false;
    if (from !== null && (move.kind !== 'move' || move.from !== from)) return false;
    if (drop && move.kind !== 'drop') return false;
    if (action && (move.kind !== 'move' || move.action !== action)) return false;
    if (betray && !move.betray?.length) return false;
    if (role && roleOfMove(position, move) !== role) return false;
    if (to.level !== undefined) {
      const parts = rulebookParts(position, move);
      if (parts.done || parts.level !== to.level) return false;
    }
    return true;
  });
};

/** The drawings of a study move as text: "green arrow from 5-7 to 5-5; red square on 4-5". */
export const describeShapes = (s: Speaker, shapes: readonly StudyShape[]): string =>
  s.t.blind.list(
    shapes.map((shape) =>
      shape.kind === 'arrow'
        ? s.t.blind.arrow(s.t.study.colors[shape.color], squareText(shape.from), squareText(shape.to))
        : s.t.blind.painted(s.t.study.colors[shape.color], squareText(shape.square)),
    ),
  );

/**
 * A drawing typed by a study's author: `arrow 5-7 5-5 red` or `square 4-5 blue` (in any language, the color optional),
 * read into a shape. `null` when the text is not a drawing command.
 */
export const parseDrawing = (s: Speaker, input: string, fallback: ShapeColor): StudyShape | null => {
  const [first = '', ...rest] = normalize(input).split(' ');
  const arrow = isWord(s, 'arrow', first);
  if (!arrow && !isWord(s, 'paint', first)) return null;
  const squares = rest.map(readSquare).filter((square) => square !== null).map((square) => square.square);
  const color = SHAPE_COLORS.find((c) => rest.some((token) => token === c || normalize(s.t.study.colors[c]) === token)) ?? fallback;
  if (arrow) return squares.length === 2 && squares[0] !== squares[1] ? { kind: 'arrow', from: squares[0]!, to: squares[1]!, color } : null;
  return squares.length === 1 ? { kind: 'square', square: squares[0]!, color } : null;
};

const COLOR_STARTS: Readonly<Record<Color, readonly string[]>> = { white: ['whit', 'bran', 'blan'], black: ['blac', 'pret', 'negr'] };

/**
 * A piece written as words, for the board editor: its name (whole or cut short), its color in any language and the
 * squares, in any order. The other words are left in `rest`.
 */
export const readPieceWords = (input: string): { role: Role | null; color: Color | null; squares: Square[]; rest: string[] } => {
  let text = ` ${normalize(input)} `;
  let role: Role | null = null;
  for (const [word, candidate] of PIECE_WORDS) {
    const pattern = word.length === 1 ? word : ` ${word} `;
    if (!role && text.includes(pattern)) {
      role = candidate;
      text = text.replace(pattern, ' ');
    }
  }
  let color: Color | null = null;
  const squares: Square[] = [];
  const rest: string[] = [];
  for (const token of text.split(' ').filter(Boolean)) {
    const square = readSquare(token);
    const tone = COLORS.find((c) => COLOR_STARTS[c].some((start) => token.startsWith(start)));
    const cut = token.length >= 3 ? new Set(PIECE_WORDS.filter(([word]) => word.split(' ').some((part) => part.startsWith(token))).map(([, r]) => r)) : new Set<Role>();
    if (square) squares.push(square.square);
    else if (tone && !color) color = tone;
    else if (!role && cut.size === 1) role = [...cut][0]!;
    else rest.push(token);
  }
  return { role, color, squares, rest };
};
