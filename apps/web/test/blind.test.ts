import { applyMove, fromRulebook, initialPosition, legalMoves, moveToString, parseFen, parseMove, type Move } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import {
  describeHands,
  describeMove,
  describePosition,
  describeReach,
  describeShapes,
  describeSquare,
  matchMoves,
  moveNotes,
  parseCommand,
  parseDrawing,
  readPieceWords,
  type Speaker,
} from '../src/blind.ts';
import { en } from '../src/i18n/en.tsx';
import { es } from '../src/i18n/es.tsx';
import { pt } from '../src/i18n/pt.tsx';

const portuguese: Speaker = { t: pt, names: 'pt' };
const english: Speaker = { t: en, names: 'en' };
const spanish: Speaker = { t: es, names: 'es' };
const start = initialPosition('beginner');
const legal = legalMoves(start);
const move = (text: string): Move => parseMove(text)!;
const matched = (input: string, speaker = portuguese) => matchMoves(speaker, start, legal, input)?.map(moveToString) ?? null;

describe('screen reader descriptions', () => {
  it('describes moves, stacks, drops and captures in each language', () => {
    expect(describeMove(portuguese, start, move('d3d4'))).toBe('Branco: Samurai de 6-7 para 6-6.');
    expect(describeMove(english, start, move('d3d4'))).toBe('White: Samurai from 6-7 to 6-6.');
    expect(describeMove(spanish, start, move('d3d4'))).toBe('Las blancas: Samurái de 6-7 a 6-6.');
    expect(describeMove(portuguese, start, move('e2f3='))).toBe('Branco: Lanceiro de 5-8 para 4-7, empilhado sobre Samurai do Branco, nível 2.');
    expect(describeMove(portuguese, start, move('J*f3'))).toBe('Branco coloca Major-General da mão em 4-7, nível 2.');
    const facing = parseFen('4m4/9/9/9/4s4/4S4/9/9/4M4 w - beginner p w');
    expect(describeMove(portuguese, facing, move('e4e5x'))).toBe('Branco: Samurai de 5-6 captura em 5-5. Sai Samurai do Preto.');
    expect(describeMove(english, facing, move('e4e5x'))).toBe('White: Samurai from 5-6 captures on 5-5. Captured: the black Samurai.');
    expect(describeMove(portuguese, initialPosition('advanced'), { kind: 'done' })).toBe('Branco declarou pronto.');
  });

  it('notes the end of the draft and a Marshal under attack', () => {
    const facing = parseFen('4m4/9/9/9/9/4S4/9/9/4M4 w - beginner p w');
    const after = applyMove(facing, move('e4e5'));
    expect(moveNotes(portuguese, facing, after)).toEqual([]);
    const nearMarshal = parseFen('4m4/9/4S4/9/9/9/9/9/4M4 w - beginner p w');
    const attack = legalMoves(nearMarshal).find((m) => m.kind === 'move' && m.to === fromRulebook(5, 2));
    expect(attack).toBeDefined();
    expect(moveNotes(portuguese, nearMarshal, applyMove(nearMarshal, attack!))).toEqual(['Xeque: o Marechal do Preto está atacado.']);
  });

  it('reads squares, towers, hands, reach and the whole position', () => {
    expect(describeSquare(portuguese, start, fromRulebook(4, 7))).toBe('4-7: Samurai do Branco.');
    expect(describeSquare(portuguese, start, fromRulebook(5, 5))).toBe('5-5: vazia.');
    const stacked = applyMove(start, move('e2f3='));
    expect(describeSquare(portuguese, stacked, fromRulebook(4, 7))).toBe('4-7, torre de 2: nível 1 Samurai do Branco e nível 2 Lanceiro do Branco.');
    expect(describeHands(portuguese, start)).toContain('Mão do Branco: ');
    expect(describeReach(portuguese, start, fromRulebook(6, 7))).toBe('Samurai do Branco em 6-7: move para 6-6, 5-6, 7-6 e 6-8.');
    // The side not to move is answered as if it were its turn.
    expect(describeReach(portuguese, start, fromRulebook(6, 3))).toMatch(/^Samurai do Preto em 6-3: move para /);
    const position = describePosition(portuguese, start);
    expect(position).toMatch(/^Vez do Branco\. /);
    expect(position).toContain('Marechal em 5-9');
    expect(describePosition(portuguese, stacked)).toContain('Lanceiro em 4-7, sobre Samurai do Branco');
  });
});

describe('typed moves', () => {
  it('takes the machine notation, the rulebook notation and its variant with piece names', () => {
    expect(matched('d3d4')).toEqual(['d3d4']);
    expect(matched('6-6-1 侍')).toEqual(['d3d4']);
    expect(matched('6-6-1 Samurai')).toEqual(['d3d4']);
    expect(matched('6-6-1 samurái', spanish)).toEqual(['d3d4']);
  });

  it('takes squares and a piece name in any order, names cut short and action words', () => {
    expect(matched('6-6 samurai')).toEqual(['d3d4']);
    expect(matched('samurai 6-6')).toEqual(['d3d4']);
    expect(matched('sam 6-6')).toEqual(['d3d4']);
    expect(matched('6-7 6-6')).toEqual(['d3d4']);
    expect(matched('5-6 samurai')).toEqual(['d3e4', 'f3e4']);
    expect(matched('4-7 lanceiro')).toEqual(['N*f3', 'e2f3=']);
    expect(matched('4-7 lanceiro empilha')).toEqual(['e2f3=']);
    expect(matched('lancer 4-7 new', english)).toEqual(['N*f3']);
    expect(matched('tenente-general 4-7')).toEqual([]);
    expect(matched('major 4-7', english)).toEqual(['J*f3']);
    expect(matched('4-7-2 major general', english)).toEqual(['J*f3']);
  });

  it('skips the words people put between squares and takes the machine notation without its action mark', () => {
    expect(matched('samurai de 6-7 para 6-6')).toEqual(['d3d4']);
    expect(matched('samurai from 6-7 to 6-6', english)).toEqual(['d3d4']);
    expect(matched('e2f3')).toEqual(['e2f3=']);
    expect(matched('e2f3x')).toEqual([]);
  });

  it('gives null for text that is not a move', () => {
    expect(matched('qualquer coisa')).toBeNull();
    expect(matched('samurai')).toBeNull();
    expect(matched('6-6 6-5 6-4')).toBeNull();
  });
});

describe('typed commands', () => {
  it('reads the short letters and the words of the language', () => {
    expect(parseCommand(portuguese, 'p')).toEqual({ kind: 'position' });
    expect(parseCommand(portuguese, 'Posição')).toEqual({ kind: 'position' });
    expect(parseCommand(portuguese, 'c 4-7')).toEqual({ kind: 'square', square: fromRulebook(4, 7) });
    expect(parseCommand(portuguese, 'casa f3')).toEqual({ kind: 'square', square: fromRulebook(4, 7) });
    expect(parseCommand(portuguese, 'l 6-7')).toEqual({ kind: 'reach', square: fromRulebook(6, 7) });
    expect(parseCommand(portuguese, 'mãos')).toEqual({ kind: 'hands' });
    expect(parseCommand(portuguese, '?')).toEqual({ kind: 'help' });
    expect(parseCommand(portuguese, '2')).toEqual({ kind: 'pick', index: 2 });
    expect(parseCommand(portuguese, 'desistir')).toEqual({ kind: 'resign' });
    expect(parseCommand(spanish, 'tablas')).toEqual({ kind: 'draw' });
    expect(parseCommand(english, 'done')).toEqual({ kind: 'done' });
    expect(parseCommand(portuguese, 'pronto')).toEqual({ kind: 'done' });
    expect(parseCommand(portuguese, '6-6 samurai')).toEqual({ kind: 'move', text: '6-6 samurai' });
    expect(parseCommand(portuguese, '   ')).toBeNull();
  });
});

describe('navigation, drawings and the editor', () => {
  it('reads the navigation and goal commands', () => {
    expect(parseCommand(portuguese, '<')).toEqual({ kind: 'prev' });
    expect(parseCommand(portuguese, 'próximo')).toEqual({ kind: 'next' });
    expect(parseCommand(portuguese, 'inicio')).toEqual({ kind: 'first' });
    expect(parseCommand(spanish, 'fin')).toEqual({ kind: 'end' });
    expect(parseCommand(portuguese, 'g')).toEqual({ kind: 'goal' });
    expect(parseCommand(english, 'goal')).toEqual({ kind: 'goal' });
  });

  it('reads and describes the drawings of a study', () => {
    const arrow = parseDrawing(portuguese, 'seta 5-7 5-5 vermelho', 'green');
    expect(arrow).toEqual({ kind: 'arrow', from: fromRulebook(5, 7), to: fromRulebook(5, 5), color: 'red' });
    expect(parseDrawing(english, 'paint 4-5', 'blue')).toEqual({ kind: 'square', square: fromRulebook(4, 5), color: 'blue' });
    expect(parseDrawing(spanish, 'flecha 5-7 5-7 rojo', 'green')).toBeNull();
    expect(parseDrawing(portuguese, '6-6 samurai', 'green')).toBeNull();
    expect(describeShapes(portuguese, [arrow!, { kind: 'square', square: fromRulebook(4, 5), color: 'blue' }])).toBe(
      'seta em vermelho de 5-7 para 5-5 e casa 4-5 pintada de azul',
    );
    expect(describeShapes(english, [arrow!])).toBe('red arrow from 5-7 to 5-5');
  });

  it('reads a piece, its color and squares for the board editor in any order and language', () => {
    expect(readPieceWords('4-7 samurai branco')).toEqual({ role: 'samurai', color: 'white', squares: [fromRulebook(4, 7)], rest: [] });
    expect(readPieceWords('black tenente-general 5-5')).toEqual({ role: 'lieutenant', color: 'black', squares: [fromRulebook(5, 5)], rest: [] });
    expect(readPieceWords('negras arq')).toEqual({ role: 'archer', color: 'black', squares: [], rest: [] });
    expect(readPieceWords('p')).toEqual({ role: null, color: null, squares: [], rest: ['p'] });
  });
});
