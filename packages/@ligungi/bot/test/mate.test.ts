import { applyMove, legalMoves, moveToString, parseFen, parseMove, type Position } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import { checkingMoves, isForcedMate, longestDefense, mateDistance, mateSolutions } from '../src/index.ts';

// Two positions found by scripts/mate-problems.ts, with the solutions it recorded.
const MATE_IN_TWO = { fen: '4m4/p6(yj)1/p5(fj)2/g1f6/9/7(YN)1/PM2(PR)4/5(FL)3/2r6 b - intro p w', line: ['a6b5', 'b3a2', 'b5b1'] };
const MATE_IN_ONE = { fen: '9/2M6/mk7/7(fr)1/2P3(sf)2/4P4/9/5(CPF)2(KS)/1(YP)7 w - advanced p w', line: ['c8b7='] };

const play = (position: Position, text: string): Position => applyMove(position, parseMove(text)!);

describe('mate search', () => {
  it('finds a mate in one and nothing shorter or longer than needed', () => {
    const position = parseFen(MATE_IN_ONE.fen);
    expect(mateDistance(position, 3)).toBe(1);
    expect(mateSolutions(position, 1).map(moveToString)).toEqual(MATE_IN_ONE.line);
    expect(legalMoves(play(position, MATE_IN_ONE.line[0]!))).toEqual([]);
  });

  it('solves a mate in two with a single first move and the longest defense', () => {
    const position = parseFen(MATE_IN_TWO.fen);
    expect(mateDistance(position, 3)).toBe(2);
    expect(mateSolutions(position, 1)).toEqual([]);
    expect(mateSolutions(position, 2).map(moveToString)).toEqual([MATE_IN_TWO.line[0]]);
    const afterKey = play(position, MATE_IN_TWO.line[0]!);
    expect(isForcedMate(afterKey, 1)).toBe(true);
    expect(isForcedMate(afterKey, 0)).toBe(false);
    expect(moveToString(longestDefense(afterKey, 1)!)).toBe(MATE_IN_TWO.line[1]);
    const final = play(play(afterKey, MATE_IN_TWO.line[1]!), MATE_IN_TWO.line[2]!);
    expect(legalMoves(final)).toEqual([]);
    expect(longestDefense(final, 0)).toBeNull();
  });

  it('only counts moves that attack the Marshal, as in tsume', () => {
    const position = parseFen(MATE_IN_TWO.fen);
    const checks = checkingMoves(position).map(({ move }) => moveToString(move));
    expect(checks).toContain(MATE_IN_TWO.line[0]);
    expect(checks.length).toBeLessThan(legalMoves(position).length);
    // A quiet move never solves a problem, even if it might lead to mate later.
    const quiet = legalMoves(position).find((move) => !checks.includes(moveToString(move)))!;
    expect(mateSolutions(position, 2).map(moveToString)).not.toContain(moveToString(quiet));
  });
});
