import { describe, expect, it } from 'vitest';
import { Game, initialPosition, legalMoves, moveToRulebook, moveToString, parseGameRecord, type GameRecord, type Move } from '../src/index.ts';

/** Plays the first legal move of each turn, the way a test game is usually built. */
const playSome = (mode: 'intro' | 'advanced', count: number): Game => {
  const game = new Game(initialPosition(mode));
  for (let i = 0; i < count && !game.outcome; i++) {
    const legal = game.legalMoves();
    game.play(legal.find((move) => move.kind === 'move') ?? legal[0]!);
  }
  return game;
};

/** The game as the export writes it: tags, then `n. rulebook {machine}` lines. */
const exported = (game: Game, mode: string): string => {
  const replay = new Game(initialPosition(game.position.mode));
  const lines = ['[Site "https://ligungi.org/abcd1234"]', `[Mode "${mode}"]`, '[White "Gon"]', '[Black "Killua"]', '[FirstPlayer "white"]', ''];
  game.moves.forEach((move, index) => {
    lines.push(`${index + 1}. ${moveToRulebook(replay.position, move)} {${moveToString(move)}}`);
    replay.play(move);
  });
  return [...lines, '', '1-0', ''].join('\n');
};

const strings = (moves: readonly Move[]) => moves.map(moveToString);

describe('game records', () => {
  it('reads back the export format', () => {
    const game = playSome('intro', 12);
    const record = parseGameRecord(exported(game, 'intro')) as GameRecord;
    expect(record).toMatchObject({ mode: 'intro', firstPlayer: 'white', freeDraft: false, tags: { White: 'Gon' } });
    expect(strings(record.moves)).toEqual(strings(game.moves));
  });

  it('still reads games where Black moved first, as the rulebook allows and older games of the site did', () => {
    const game = new Game(initialPosition('intro', 'black'));
    const first = game.legalMoves().find((move) => move.kind === 'move')!;
    game.play(first);
    const text = `[Mode "intro"]\n[FirstPlayer "black"]\n\n1. ${moveToString(first)}\n`;
    const record = parseGameRecord(text) as GameRecord;
    expect(record.firstPlayer).toBe('black');
    expect(strings(record.moves)).toEqual([moveToString(first)]);
  });

  it('reads moves in rulebook notation alone, several on a line, with the mode chosen on the page', () => {
    const game = playSome('intro', 6);
    const replay = new Game(initialPosition('intro'));
    const words = game.moves.map((move, index) => {
      const text = `${index + 1}. ${moveToRulebook(replay.position, move)}`;
      replay.play(move);
      return text;
    });
    const text = `${words.slice(0, 3).join(' ')}\n${words.slice(3).join('  ')}`;
    expect(strings((parseGameRecord(text, 'intro') as GameRecord).moves)).toEqual(strings(game.moves));
  });

  it('points at the line of a move the rules do not allow', () => {
    const game = playSome('intro', 2);
    const text = `${exported(game, 'intro').replace(/\n\n1-0\n$/, '')}\n3. a1a2\n`;
    expect(parseGameRecord(text)).toEqual({ kind: 'illegal', line: 9, text: 'a1a2' });
    expect(parseGameRecord('[Mode "chess"]\n1. e2e4')).toEqual({ kind: 'badMode', line: 1, text: 'chess' });
    expect(parseGameRecord('1. hello there', 'intro')).toEqual({ kind: 'unreadable', line: 1, text: 'hello there' });
    expect(parseGameRecord('   \n')).toEqual({ kind: 'empty', line: 1, text: '' });
  });

  it('refuses rulebook moves two pieces could make, which only machine notation tells apart', () => {
    const start = initialPosition('intro');
    const written = legalMoves(start).map((move) => moveToRulebook(start, move));
    const shared = written.find((text, index) => written.indexOf(text) !== index);
    expect(shared).toBeDefined();
    expect(parseGameRecord(`1. ${shared}`, 'intro')).toEqual({ kind: 'ambiguous', line: 1, text: shared });
  });
});
