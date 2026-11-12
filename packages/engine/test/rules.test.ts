import { describe, expect, it } from 'vitest';
import {
  Game,
  applyMove,
  crossedCells,
  dropFrontier,
  initialPosition,
  isMarshalAttacked,
  material,
  parseMove,
  toFen,
} from '../src/index.ts';
import { build, moveStrings, movesFrom, sq } from './helpers.ts';

const play = (position: ReturnType<typeof build>, move: string) => applyMove(position, parseMove(move)!);

describe('stacking and capturing', () => {
  it('offers capture or stack on an enemy of equal or lower height', () => {
    expect(movesFrom(build({ e5: 'P', e6: 'p' }), 'e5')).toEqual(expect.arrayContaining(['e6x', 'e6=']));
  });

  it('cannot touch a taller enemy tower', () => {
    expect(movesFrom(build({ e5: 'P', e6: 'pp' }), 'e5')).toEqual(['e4']);
  });

  it('removes only enemy pieces when capturing a mixed tower (FAQ Q17)', () => {
    const after = play(build({ e5: 'PPY', f6: 'pPp' }), 'e5f6x');
    expect(after.board[sq('f6')]).toEqual([
      { role: 'soldier', color: 'white' },
      { role: 'spy', color: 'white' },
    ]);
    expect(after.board[sq('e5')]).toHaveLength(2);
  });

  it('cannot capture an enemy piece covered by an own piece (FAQ Q26, Q27)', () => {
    expect(movesFrom(build({ e5: 'PP', e6: 'pP' }), 'e5')).not.toContain('e6x');
  });

  it('respects the stack limit of each mode', () => {
    expect(movesFrom(build({ e5: 'PP', e6: 'pp' }, { mode: 'intermediate' }), 'e5')).not.toContain('e6=');
    expect(movesFrom(build({ e5: 'PP', e6: 'pp' }, { mode: 'advanced' }), 'e5')).toContain('e6=');
  });

  it('never stacks on a marshal', () => {
    const position = build({ e5: 'P', e6: 'M', e7: 'm' }, { turn: 'black' });
    expect(movesFrom(position, 'e7')).not.toContain('e6=');
    expect(movesFrom(build({ e5: 'P', e6: 'M' }), 'e5')).not.toContain('e6=');
  });

  it('lets the marshal stack only in intermediate and advanced (FAQ Q14)', () => {
    expect(movesFrom(build({ e5: 'M', e6: 'P' }, { mode: 'beginner' }), 'e5')).not.toContain('e6=');
    expect(movesFrom(build({ e5: 'M', e6: 'P' }, { mode: 'intermediate' }), 'e5')).toContain('e6=');
  });
});

describe('drops', () => {
  it('drops up to the rank of the most advanced own top piece, beyond the home zone', () => {
    const position = build({ e1: 'M', c4: 'P' }, { hands: { white: { spy: 1 } } });
    const drops = moveStrings(position).filter((m) => m.startsWith('Y*'));
    expect(drops).toContain('Y*h4');
    expect(drops).not.toContain('Y*h5');
  });

  it('ignores own pieces covered by enemy pieces for the frontier (FAQ Q25)', () => {
    const position = build({ e1: 'M', c6: 'Pp' }, { hands: { white: { spy: 1 } } });
    expect(dropFrontier(position, 'white')).toBe(0);
  });

  it('drops on own pieces but not on enemies, marshals or full towers (FAQ Q29)', () => {
    const position = build(
      { e1: 'M', d1: 'P', f1: 'Pp', c1: 'PPP', b2: 'P' },
      { hands: { white: { spy: 1 } } },
    );
    const drops = moveStrings(position).filter((m) => m.startsWith('Y*'));
    expect(drops).toContain('Y*d1');
    expect(drops).not.toContain('Y*e1');
    expect(drops).not.toContain('Y*f1');
    expect(drops).not.toContain('Y*c1');
  });
});

describe('tactician betrayal', () => {
  it('swaps every enemy piece of the tower for same-role pieces from hand when stacking', () => {
    const position = build({ e5: 'PT', f6: 'pr' }, { hands: { white: { soldier: 1, rider: 1 } } });
    const moves = movesFrom(position, 'e5').filter((m) => m.startsWith('f6'));
    expect(moves.sort()).toEqual(['f6=', 'f6=^12', 'f6x']);
    const after = play(position, 'e5f6=^12');
    expect(after.board[sq('f6')]!.map((p) => p.color)).toEqual(['white', 'white', 'white']);
    expect(after.board[sq('e5')]).toHaveLength(1);
    expect(after.hands.white.soldier).toBe(0);
    expect(after.hands.white.rider).toBe(0);
    expect(material(after).black.soldier).toBe(0);
    expect(material(after).black.rider).toBe(0);
  });

  it('does not allow a partial betrayal (軍儀Web)', () => {
    const position = build({ e5: 'PT', f6: 'pr' }, { hands: { white: { soldier: 1 } } });
    expect(movesFrom(position, 'e5').filter((m) => m.includes('^'))).toEqual([]);
  });

  it('can betray an enemy piece under an own top piece when moving there', () => {
    const position = build({ e5: 'PT', f6: 'pS' }, { hands: { white: { soldier: 1 } } });
    expect(movesFrom(position, 'e5')).toContain('f6=^1');
  });

  it('requires a matching piece in hand (FAQ Q22) and never applies to captures (FAQ Q28)', () => {
    const moves = movesFrom(build({ e5: 'T', f6: 'p' }), 'e5');
    expect(moves.filter((m) => m.includes('^'))).toEqual([]);
    const withHand = movesFrom(build({ e5: 'T', f6: 'p' }, { hands: { white: { soldier: 1 } } }), 'e5');
    expect(withHand.filter((m) => m.startsWith('f6x'))).toEqual(['f6x']);
  });

  it('applies when the tactician is dropped on an own tower with an enemy below (FAQ Q30)', () => {
    const position = build({ e1: 'M', d2: 'sS' }, { hands: { white: { tactician: 1, samurai: 1 } } });
    expect(moveStrings(position)).toContain('T*d2^1');
  });
});

describe('end of game', () => {
  it('forbids moves that expose the own marshal', () => {
    const position = build({ e1: 'M', e3: 'J', e9: 'g' });
    const moves = movesFrom(position, 'e3');
    expect(moves).not.toContain('d3');
    expect(moves).not.toContain('f3');
    expect(moves).toContain('e4');
  });

  it('declares mate when no move keeps the marshal safe, even without check', () => {
    const position = build({ e1: 'M', i9: 'm', a8: 'G', f7: 'L' }, { turn: 'black' });
    expect(isMarshalAttacked(position, 'black')).toBe(false);
    const game = new Game(position);
    expect(game.outcome).toEqual({ winner: 'white', reason: 'mate' });
  });

  it('ends the game when the marshal is captured (rulebook, FAQ Q10)', () => {
    const game = new Game(initialPosition('advanced', 'white'));
    for (const move of ['M*a1', 'M*e7', 'G*e3', 'P*a9', 'done', 'done']) game.play(parseMove(move)!);
    expect(game.position.phase).toBe('play');
    expect(game.outcome).toBeUndefined();
    game.play(parseMove('e3e7x')!);
    expect(game.outcome).toEqual({ winner: 'white', reason: 'capture' });
  });

  it('lets drops save the marshal', () => {
    const position = build({ e1: 'M', i9: 'm', a8: 'G', f7: 'L' }, { turn: 'black', hands: { black: { soldier: 1 } } });
    expect(new Game(position).outcome).toBeUndefined();
  });

  it('draws on the fourth occurrence of a position', () => {
    const game = new Game(build({ a1: 'M', i9: 'm', a3: 'P', i7: 'p' }));
    for (let i = 0; i < 3; i++) {
      for (const move of ['a3a4', 'i7i6', 'a4a3', 'i6i7']) game.play(move);
    }
    expect(game.outcome).toEqual({ winner: null, reason: 'repetition' });
  });

  it('draws when only the marshals remain', () => {
    const game = new Game(build({ a1: 'M', i9: 'm', b2: 'p' }));
    game.play('a1b2x');
    expect(game.outcome).toEqual({ winner: null, reason: 'insufficient' });
  });
});

describe('draft', () => {
  it('requires the marshal first, inside the home zone', () => {
    const moves = moveStrings(initialPosition('advanced'));
    expect(moves.every((m) => m.startsWith('M*'))).toBe(true);
    expect(moves).toHaveLength(27);
  });

  it('lets one player keep placing after the other declares done, then starts with White', () => {
    const game = new Game(initialPosition('intermediate'));
    game.play('M*e1');
    game.play('M*e9');
    game.play('done');
    expect(game.position.turn).toBe('black');
    game.play('P*e7');
    game.play('P*d7');
    expect(game.position.turn).toBe('black');
    game.play('done');
    expect(game.position.phase).toBe('play');
    expect(game.position.turn).toBe('white');
    expect(toFen(game.position)).toContain(' intermediate p');
  });

  it('ends the draft for both as soon as the second player declares done (rulebook p.6)', () => {
    const game = new Game(initialPosition('advanced'));
    game.play('M*e1');
    game.play('M*e9');
    game.play('P*d1');
    game.play('done');
    expect(game.position.phase).toBe('play');
    expect(game.position.turn).toBe('white');
    expect(game.position.hands.white.soldier).toBe(3);
  });

  it('lets the first player keep placing after the second declares done with the free draft option', () => {
    const game = new Game(initialPosition('advanced', 'white', { freeDraft: true }));
    game.play('M*e1');
    game.play('M*e9');
    game.play('P*d1');
    game.play('done');
    expect(game.position.phase).toBe('draft');
    expect(game.position.turn).toBe('white');
    game.play('P*f1');
    game.play('P*g1');
    game.play('done');
    expect(game.position.phase).toBe('play');
    expect(game.position.turn).toBe('white');
    expect(game.position.hands.white.soldier).toBe(1);
    expect(toFen(game.position).endsWith(' p+ w')).toBe(true);
  });

  it('ignores the free draft option in modes with a fixed setup', () => {
    expect(initialPosition('beginner', 'white', { freeDraft: true }).freeDraft).toBe(false);
  });

  it('keeps the first player independent of color (FAQ Q20)', () => {
    const game = new Game(initialPosition('advanced', 'black'));
    expect(game.position.turn).toBe('black');
    game.play('M*e9');
    game.play('M*e1');
    game.play('done');
    expect(game.position.turn).toBe('white');
    game.play('done');
    expect(game.position.phase).toBe('play');
    expect(game.position.turn).toBe('black');
    expect(toFen(game.position).endsWith(' p b')).toBe(true);
    expect(initialPosition('intro', 'black').turn).toBe('black');
  });

  it('does not allow stacking on the marshal during the draft', () => {
    const game = new Game(initialPosition('advanced'));
    game.play('M*e1');
    game.play('M*e9');
    expect(moveStrings(game.position)).not.toContain('P*e1');
    expect(moveStrings(game.position)).toContain('P*e3');
    expect(moveStrings(game.position)).not.toContain('P*e4');
  });
});

describe('archer geometry', () => {
  it('crosses the cells listed in docs/rules.md section 3.3', () => {
    expect(crossedCells(1, 2)).toEqual([[0, 1], [1, 1]]);
    expect(crossedCells(2, 3)).toEqual([[0, 1], [1, 1], [1, 2], [2, 2]]);
    expect(crossedCells(-3, 4)).toEqual([[-3, 3], [-2, 2], [-2, 3], [-1, 1], [-1, 2], [0, 1]]);
  });
});
