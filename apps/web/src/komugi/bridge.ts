// Translation between ligungi and Komugi (@komugi-ai/engine): positions, game histories and replies.
// Komugi numbers squares rank-file from Black's side and indexes piece types in `ROLES` order; its
// `canonicalMove` writes a move in ligungi's terms, so moves are matched on that text. In the draft
// Komugi attaches 終 to a placement, where ligungi spends a separate turn on `done`.

import { ROLES, applyMove, fileOf, handSize, initialPosition, legalMoves, rankOf, toFen, type Color, type Move, type Position, type Role, type Square } from '@ligungi/engine';
import { ADVANCED_POSITION, Game, MODE_ADVANCED, RepetitionRule, boardFromFen, boardToFen, buildPosition, buildSan, canonicalFen, canonicalMove, generateRecords } from '@komugi-ai/engine/rules';
import type { Board, RulesProfile } from '@komugi-ai/engine/rules';

export const KOMUGI_RULES = 'ligungi' satisfies RulesProfile;

/** Advanced, White first, rulebook draft: what Komugi's history replay and draft protocol assume. */
export type KomugiPosition = Position & { readonly mode: 'advanced'; readonly firstPlayer: 'white'; readonly freeDraft: false };

export const komugiPlays = (position: Position): position is KomugiPosition => position.mode === 'advanced' && position.firstPlayer === 'white' && !position.freeDraft;

/** Not a Komugi position; moves that do not lead to the position; a reply naming no move; a reply with no legal ligungi move. */
export type KomugiBridgeErrorCode = 'unsupported-position' | 'history-mismatch' | 'unknown-reply' | 'illegal-reply';

export class KomugiBridgeError extends Error {
  readonly code: KomugiBridgeErrorCode;
  constructor(code: KomugiBridgeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const fail = (code: KomugiBridgeErrorCode, message: string): never => {
  throw new KomugiBridgeError(code, message);
};

/** Komugi's 0-based `[rank, file]`: rank 0 is Black's back rank, file 0 is White's right. */
export const toKomugiSquare = (square: Square): readonly [rank: number, file: number] => [8 - rankOf(square), 8 - fileOf(square)];
export const fromKomugiSquare = (rank: number, file: number): Square => (8 - rank) * 9 + (8 - file);

const COLOR: Readonly<Record<Color, number>> = { white: 0, black: 1 };
const DONE = '+done';
const piece = (role: Role, color: Color) => ({ piece: ROLES.indexOf(role), color: COLOR[color] });

/** The move number matters only with a history, and `komugiSearchInput` then takes the FEN from Komugi's replay. */
export const komugiFen = (position: KomugiPosition, moveNumber = 1): string => {
  if (!komugiPlays(position)) fail('unsupported-position', 'Komugi plays only Advanced games with White first and the rulebook draft');
  const { board, hands, phase, draftDone } = position;
  const cells = Array.from({ length: 9 }, (_, rank) => Array.from({ length: 9 }, (_, file) => (board[fromKomugiSquare(rank, file)] ?? []).map((p) => piece(p.role, p.color))));
  const hand = (['white', 'black'] as const).flatMap((color) => ROLES.filter((role) => hands[color][role] > 0).map((role) => ({ ...piece(role, color), count: hands[color][role] })));
  const drafting = { w: phase === 'draft' && !draftDone.white, b: phase === 'draft' && !draftDone.black };
  return buildPosition({ cells, hand, turn: COLOR[position.turn], mode: MODE_ADVANCED, drafting, moveNumber });
};

const squareText = (square: Square): string => toKomugiSquare(square).map((n) => n + 1).join('-');

/** `canonicalMove`'s text without its `+done`: betrayed tiers are 1-based, after `^`. */
const canonicalOf = (move: Exclude<Move, { kind: 'done' }>): string => {
  const betray = move.betray?.length ? `^${[...move.betray].sort((a, b) => a - b).map((level) => level + 1).join('')}` : '';
  return move.kind === 'drop' ? `D:${move.role}@${squareText(move.to)}${betray}` : `M:${squareText(move.from)}>${squareText(move.to)}:${move.action}${betray}`;
};

// The game rewritten in Komugi's draft protocol and replayed: each side's placements in order, alternating
// while both draft, with 終 on the last placement of a side that finished (by `done` or an empty hand).
// That reaches the same position, except for a draft Black ended right after a White placement: Komugi
// finishes Black with a placement, so it cannot leave White a piece ahead.
const komugiHistory = (moves: readonly Move[]): { history: string[]; board: Board } | null => {
  const drops: Record<Color, Extract<Move, { kind: 'drop' }>[]> = { white: [], black: [] };
  const finished = { white: false, black: false };
  const play: Move[] = [];
  let position: Position = initialPosition('advanced', 'white');
  for (const move of moves) {
    if (position.phase === 'play') play.push(move);
    else if (move.kind === 'move') return null;
    else if (move.kind === 'drop') drops[position.turn].push(move);
    if (position.phase === 'draft' && (move.kind === 'done' || handSize(position.hands[position.turn]) === 1)) finished[position.turn] = true;
    position = applyMove(position, move);
  }
  const game = new Game(boardFromFen(ADVANCED_POSITION), RepetitionRule.FULL, 1, KOMUGI_RULES);
  const history: string[] = [];
  const played = (text: string): boolean => {
    const record = generateRecords(game.board, KOMUGI_RULES).find((r) => canonicalMove(r.struct) === text);
    if (!record) return false;
    history.push(buildSan(game.board, record.struct));
    game.play(record.id);
    return true;
  };
  const queued = { white: 0, black: 0 };
  while (queued.white < drops.white.length || queued.black < drops.black.length) {
    const color: Color = game.board.turn === 0 ? 'white' : 'black';
    const drop = drops[color][queued[color]++];
    const last = queued[color] === drops[color].length && finished[color];
    if ((color === 'white' ? game.board.draftW : game.board.draftB) === 0 || !drop || !played(canonicalOf(drop) + (last ? DONE : ''))) return null;
  }
  for (const move of play) if (move.kind === 'done' || !played(canonicalOf(move))) return null;
  return { history, board: game.board };
};

/** The history is null when the game has no Komugi equivalent, or was not given. */
export type KomugiSearchInput = { readonly fen: string; readonly history: string[] | null };

const withoutMoveNumber = (fen: string): string => canonicalFen(fen).replace(/ \d+$/, '');
const bare = (san: string): string => san.replace(/[=#]+$/, '');

/** `moves`, the game from the Advanced start, give the search its repetition history. */
export const komugiSearchInput = (position: KomugiPosition, moves?: readonly Move[]): KomugiSearchInput => {
  const fen = komugiFen(position);
  if (moves === undefined) return { fen, history: null };
  let replayed: Position | null = null;
  try {
    replayed = moves.reduce(applyMove, initialPosition('advanced', 'white'));
  } catch {} // A move that cannot be played fails the check below.
  if (!replayed || toFen(replayed) !== toFen(position)) fail('history-mismatch', 'The moves do not lead from the Advanced start to the position');
  const komugi = komugiHistory(moves);
  if (!komugi || withoutMoveNumber(boardToFen(komugi.board)) !== withoutMoveNumber(fen)) return { fen, history: null };
  return { fen: boardToFen(komugi.board), history: komugi.history };
};

/** An action id, a SAN, or both (then they must agree). */
export type KomugiReply = { readonly action: number; readonly san?: string } | { readonly action?: number; readonly san: string };

/** Moves to play now (one, or a placement then `done`), and whether `done` is owed at the side's next turn instead. */
export type KomugiReplyMoves = { readonly moves: readonly Move[]; readonly doneNextTurn: boolean };

/** Prepares both engines' legal moves once, for many replies. `legal`, when given, must be `legalMoves(position)`. */
export const komugiReplyMapper = (position: KomugiPosition, legal: readonly Move[] = legalMoves(position)): ((reply: KomugiReply) => KomugiReplyMoves) => {
  const board = boardFromFen(komugiFen(position));
  const structs = new Map(generateRecords(board, KOMUGI_RULES).map((r) => [r.id, r.struct]));
  const byCanonical = new Map(legal.flatMap((move) => (move.kind === 'done' ? [] : [[canonicalOf(move), move] as const])));
  let sans: Map<string, number> | undefined;
  return ({ action = -1, san }) => {
    if (san !== undefined) {
      // Without check marks (= and #), reversed so that the first move with a SAN keeps it.
      sans ??= new Map([...structs].reverse().map(([id, struct]) => [bare(buildSan(board, struct)), id]));
      const fromSan = sans.get(bare(san)) ?? fail('unknown-reply', `SAN ${san} names no legal Komugi move here`);
      if (action !== -1 && action !== fromSan) fail('unknown-reply', `SAN ${san} is action ${fromSan}, not ${action}`);
      action = fromSan;
    }
    const canonical = canonicalMove(structs.get(action) ?? fail('illegal-reply', `Action ${action} is not a legal Komugi move here`));
    const finish = canonical.endsWith(DONE);
    const move = byCanonical.get(finish ? canonical.slice(0, -DONE.length) : canonical) ?? fail('illegal-reply', `${canonical} has no legal ligungi move`);
    const after = finish ? applyMove(position, move) : null;
    // With the last piece of the hand, ligungi declares done by itself.
    if (!after || after.phase === 'play' || after.draftDone[position.turn]) return { moves: [move], doneNextTurn: false };
    if (after.turn !== position.turn) return { moves: [move], doneNextTurn: true };
    return { moves: [move, pendingDone(after, position.turn) ?? fail('illegal-reply', `${canonical}: done is not legal after the placement`)], doneNextTurn: false };
  };
};

export const komugiReplyToLigungi = (position: KomugiPosition, reply: KomugiReply): KomugiReplyMoves => komugiReplyMapper(position)(reply);

/** The `done` owed after a reply with `doneNextTurn`, if it is legal now; null when the draft ended meanwhile. */
export const pendingDone = (position: Position, side: Color): Move | null =>
  position.phase === 'draft' && position.turn === side && !position.draftDone[side] ? (legalMoves(position).find((move) => move.kind === 'done') ?? null) : null;
