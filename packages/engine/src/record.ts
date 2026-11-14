import { Game } from './game.ts';
import { initialPosition } from './position.ts';
import { moveToRulebook, moveToString, parseMove } from './notation.ts';
import { MODES, type Color, type Mode, type Move } from './types.ts';

/** A game read from text: what it needs to be replayed from the start. */
export interface GameRecord {
  readonly mode: Mode;
  readonly firstPlayer: Color;
  readonly freeDraft: boolean;
  readonly moves: readonly Move[];
  /** The `[Name "value"]` pairs found, as written. */
  readonly tags: Readonly<Record<string, string>>;
}

/** Why a text could not be read as a game, with the line (counted from 1) and the move text at fault. */
export interface RecordError {
  readonly kind: 'empty' | 'badMode' | 'unreadable' | 'illegal' | 'ambiguous' | 'afterEnd';
  readonly line: number;
  readonly text: string;
}

const TAG = /^\[(\w+)\s+"(.*)"\]$/;
const RESULT = /^(1-0|0-1|½-½|1\/2-1\/2|\*|\?)$/;
const RULEBOOK = /^(\d-\d-\d\s|済み$)/;

/**
 * Reads a game in the export format (`GET /api/games/:id/export`): optional tag pairs, then the moves, one or more per
 * line, each optionally numbered (`12.`). A move is taken from the machine notation in braces when present, otherwise
 * from the text itself, in machine or in rulebook notation. Rulebook notation names no starting square, so it is matched
 * against the legal moves of the position, and a move two pieces could make is reported as ambiguous. Every move is
 * checked by the rules. `fallbackMode` is used when no `Mode` tag says otherwise.
 */
export const parseGameRecord = (text: string, fallbackMode: Mode = 'advanced'): GameRecord | RecordError => {
  const lines = text.split(/\r?\n/);
  const tags: Record<string, string> = {};
  let index = 0;
  for (; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (!line) continue;
    const tag = TAG.exec(line);
    if (!tag) break;
    tags[tag[1]!] = tag[2]!;
  }
  const modeLine = lines.findIndex((line) => /^\[Mode\s/.test(line.trim())) + 1;
  if (tags.Mode !== undefined && !(MODES as readonly string[]).includes(tags.Mode)) return { kind: 'badMode', line: modeLine, text: tags.Mode };
  const mode = (tags.Mode as Mode | undefined) ?? fallbackMode;
  const firstPlayer: Color = tags.FirstPlayer === 'black' ? 'black' : 'white';
  const freeDraft = tags.Draft === 'free';
  const game = new Game(initialPosition(mode, firstPlayer, { freeDraft }));

  for (; index < lines.length; index++) {
    const lineNumber = index + 1;
    // Several numbered moves may share a line; the numbers themselves are dropped.
    const entries = lines[index]!.split(/(?:^|\s)\d+\.(?=\s)/).map((entry) => entry.trim()).filter(Boolean);
    for (const entry of entries) {
      if (RESULT.test(entry)) continue;
      if (game.outcome) return { kind: 'afterEnd', line: lineNumber, text: entry };
      const legal = game.legalMoves();
      const machine = /\{([^}]*)\}/.exec(entry)?.[1]?.trim();
      const written = machine ?? entry;
      const parsed = parseMove(written);
      let move: Move | undefined;
      if (parsed) {
        move = legal.find((candidate) => moveToString(candidate) === moveToString(parsed));
        if (!move) return { kind: 'illegal', line: lineNumber, text: written };
      } else if (machine !== undefined) {
        return { kind: 'unreadable', line: lineNumber, text: machine };
      } else {
        const rulebook = entry.replace(/\s+/g, ' ');
        const matches = legal.filter((candidate) => moveToRulebook(game.position, candidate) === rulebook);
        if (matches.length > 1) return { kind: 'ambiguous', line: lineNumber, text: entry };
        if (matches.length === 0) return { kind: RULEBOOK.test(rulebook) ? 'illegal' : 'unreadable', line: lineNumber, text: entry };
        move = matches[0];
      }
      game.play(move!);
    }
  }
  if (game.moves.length === 0 && Object.keys(tags).length === 0) return { kind: 'empty', line: 1, text: '' };
  return { mode, firstPlayer, freeDraft, moves: game.moves, tags };
};
