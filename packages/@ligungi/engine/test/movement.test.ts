import { describe, expect, it } from 'vitest';
import { build, movesFrom, rel, targetsFrom } from './helpers.ts';

const relTargets = (origin: string, offsets: Array<[number, number]>) =>
  offsets.map(([dx, dy]) => rel(origin, dx, dy)).sort();

describe('basic movement on an empty board', () => {
  it('moves the samurai forward, forward-diagonally and backward', () => {
    expect(targetsFrom(build({ e5: 'S' }), 'e5')).toEqual(
      relTargets('e5', [[0, 1], [1, 1], [-1, 1], [0, -1]]),
    );
  });

  it('adds one square per extra tier', () => {
    expect(targetsFrom(build({ e5: 'PS' }), 'e5')).toEqual(
      relTargets('e5', [[0, 1], [0, 2], [1, 1], [2, 2], [-1, 1], [-2, 2], [0, -1], [0, -2]]),
    );
    expect(targetsFrom(build({ e5: 'PPS' }), 'e5')).toHaveLength(12);
  });

  it('mirrors directions for Black', () => {
    expect(targetsFrom(build({ e5: 'p' }, { turn: 'black' }), 'e5')).toEqual(['e4', 'e6']);
    expect(targetsFrom(build({ e5: 'n' }, { turn: 'black' }), 'e5')).toEqual(
      relTargets('e5', [[0, -1], [0, -2], [1, -1], [-1, -1], [0, 1]]),
    );
  });

  it('keeps the unlimited lines of general and lieutenant regardless of tier', () => {
    expect(targetsFrom(build({ e5: 'G' }), 'e5')).toHaveLength(16 + 4);
    expect(targetsFrom(build({ e5: 'PG' }), 'e5')).toHaveLength(16 + 8);
    expect(targetsFrom(build({ e5: 'L', a2: 'M', i8: 'm' }), 'e5')).toHaveLength(16 + 4);
  });

  it('moves the remaining pieces as printed in the rulebook', () => {
    const cases: Array<[string, Array<[number, number]>]> = [
      ['M', [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]],
      ['J', [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1]]],
      ['N', [[0, 1], [0, 2], [1, 1], [-1, 1], [0, -1]]],
      ['R', [[0, 1], [0, 2], [0, -1], [0, -2], [1, 0], [-1, 0]]],
      ['Y', [[1, 1], [2, 2], [-1, 1], [-2, 2], [1, -1], [2, -2], [-1, -1], [-2, -2]]],
      ['F', [[0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1]]],
      ['P', [[0, 1], [0, -1]]],
      ['T', [[1, 1], [-1, 1], [0, -1]]],
      ['C', [[0, 3], [1, 0], [-1, 0], [0, -1]]],
      ['K', [[0, 2], [1, -1], [-1, -1]]],
      ['A', [[0, 2], [1, 2], [-1, 2], [0, -1]]],
    ];
    for (const [letter, offsets] of cases) {
      const layout = letter === 'M' ? { e5: 'M', a9: 'm' } : { e5: letter };
      expect(targetsFrom(build(layout), 'e5'), letter).toEqual(relTargets('e5', offsets));
    }
  });

  it('blocks sliding pieces with any piece on the way', () => {
    expect(targetsFrom(build({ e5: 'N', e6: 'P' }), 'e5')).not.toContain('e7');
    expect(targetsFrom(build({ e5: 'G', e7: 'p' }), 'e5')).toContain('e7');
    expect(targetsFrom(build({ e5: 'G', e7: 'p' }), 'e5')).not.toContain('e8');
  });
});

describe('jumping pieces', () => {
  it('lands the cannon 3 squares ahead at tier 1, up to 5 at tier 3', () => {
    expect(targetsFrom(build({ e2: 'C' }), 'e2')).toContain('e5');
    expect(targetsFrom(build({ e2: 'C' }), 'e2')).not.toContain('e4');
    const tier3 = targetsFrom(build({ e2: 'PPC' }), 'e2');
    expect(tier3).toEqual(expect.arrayContaining(['e5', 'e6', 'e7']));
    expect(tier3).not.toContain('e4');
  });

  it('jumps over towers no taller than itself, own or enemy', () => {
    expect(targetsFrom(build({ e2: 'C', e3: 'p', e4: 'P' }), 'e2')).toContain('e5');
    expect(targetsFrom(build({ e2: 'C', e3: 'pp' }), 'e2')).not.toContain('e5');
    expect(targetsFrom(build({ e2: 'PC', e3: 'pp' }), 'e2')).toContain('e5');
  });

  it('matches the rulebook page 12 cannon example: tier 3 over 2- and 3-high towers', () => {
    const position = build({ e2: 'PPC', e3: 'PS', e5: 'ppj' });
    expect(movesFrom(position, 'e2')).toContain('e5x');
    expect(targetsFrom(position, 'e2')).toEqual(expect.arrayContaining(['e6', 'e7']));
  });

  it('lands the musketeer 2..tier+1 squares ahead', () => {
    expect(targetsFrom(build({ e2: 'K', e3: 'p' }), 'e2')).toContain('e4');
    expect(targetsFrom(build({ e2: 'PK' }), 'e2')).toEqual(expect.arrayContaining(['e4', 'e5']));
  });
});

describe('archer, official FAQ Q21 images', () => {
  it('image 1: a 2-high tower at (+1,1) blocks only (+1,2)', () => {
    const position = build({ e3: 'A', [rel('e3', -1, 2)]: 's', [rel('e3', 0, 2)]: 't', [rel('e3', 1, 2)]: 'p', [rel('e3', 1, 1)]: 'pp' });
    const moves = movesFrom(position, 'e3');
    expect(moves).toContain(`${rel('e3', -1, 2)}x`);
    expect(moves).toContain(`${rel('e3', 0, 2)}x`);
    expect(targetsFrom(position, 'e3')).not.toContain(rel('e3', 1, 2));
  });

  it('image 2: jumps over a 1-high piece in front but cannot take it', () => {
    const position = build({ e3: 'A', e4: 'p', d5: 's', e5: 't', f5: 'p' });
    expect(targetsFrom(position, 'e3')).toEqual(expect.arrayContaining(['d5', 'e5', 'f5']));
    expect(targetsFrom(position, 'e3')).not.toContain('e4');
  });

  it('image 3: a 2-high tower right in front blocks all forward shots', () => {
    const position = build({ e3: 'A', e4: 'pp', d5: 'p', e5: 'p', f5: 'p' });
    expect(targetsFrom(position, 'e3')).toEqual(['e2']);
  });

  it('image 4: tier 2 with a 3-high tower at (+1,1) loses the right side only', () => {
    const position = build({ e3: 'PA', f4: 'ppp', c6: 'n', e6: 'j', d5: 's', e5: 't', f5: 'p', g6: 'p' });
    const targets = targetsFrom(position, 'e3');
    expect(targets).toEqual(expect.arrayContaining(['c6', 'e6', 'd5', 'e5']));
    expect(targets).not.toContain('f5');
    expect(targets).not.toContain('g6');
  });

  it('image 5: tier 3 jumps over a 3-high tower in front and reaches all nine targets', () => {
    const position = build({ e2: 'PPA', e3: 'ppp' });
    expect(targetsFrom(position, 'e2')).toEqual(
      expect.arrayContaining(['d4', 'e4', 'f4', 'c5', 'e5', 'g5', 'b6', 'e6', 'h6']),
    );
  });

  it('image 6: tier 2 takes a 2-high tower two squares ahead and can jump past it', () => {
    const position = build({ e3: 'PA', e5: 'pp', e6: 't', d5: 's', f5: 'p' });
    const moves = movesFrom(position, 'e3');
    expect(moves).toContain('e5x');
    expect(moves).toContain('e6x');
  });

  it('image 7: a 3-high tower two squares ahead blocks only the center line', () => {
    const position = build({ e3: 'PA', e5: 'ppp', e6: 't', c6: 'n', g6: 'r', d5: 's', f5: 'p' });
    const targets = targetsFrom(position, 'e3');
    expect(targets).toEqual(expect.arrayContaining(['c6', 'g6', 'd5', 'f5']));
    expect(targets).not.toContain('e5');
    expect(targets).not.toContain('e6');
  });
});
