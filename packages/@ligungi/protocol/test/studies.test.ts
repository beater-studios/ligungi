import { initialPosition, legalMoves, moveToString, toFen } from '@ligungi/engine';
import { describe, expect, it } from 'vitest';
import {
  STUDY_ARROWS_MAX,
  STUDY_NODES_MAX,
  STUDY_SQUARES_MAX,
  chapterFits,
  emptyRoot,
  parseStudyRoot,
  shapeCounts,
  studyStart,
  toggleShape,
  type StudyRoot,
  type StudyShape,
} from '../src/index.ts';

const arrow = (from: number, to: number, color: StudyShape['color'] = 'green'): StudyShape => ({ kind: 'arrow', from, to, color });
const square = (at: number, color: StudyShape['color'] = 'green'): StudyShape => ({ kind: 'square', square: at, color });

describe('study drawings', () => {
  it('adds a shape, repaints it in another color and erases it with the same one', () => {
    const one = toggleShape([], arrow(0, 1));
    expect(one).toEqual([arrow(0, 1)]);
    expect(toggleShape(one as StudyShape[], arrow(0, 1, 'red'))).toEqual([arrow(0, 1, 'red')]);
    expect(toggleShape(one as StudyShape[], arrow(0, 1))).toEqual([]);
    expect(toggleShape(one as StudyShape[], arrow(1, 0))).toHaveLength(2);
  });

  it('stops at the arrow and square limits, each on its own', () => {
    const arrows = Array.from({ length: STUDY_ARROWS_MAX }, (_, i) => arrow(i, i + 1));
    expect(toggleShape(arrows, arrow(40, 41))).toBe('limit');
    expect(toggleShape(arrows, square(5))).toHaveLength(STUDY_ARROWS_MAX + 1);
    const squares = Array.from({ length: STUDY_SQUARES_MAX }, (_, i) => square(i));
    expect(toggleShape(squares, square(60))).toBe('limit');
    // Erasing or repainting is always allowed, even at the limit.
    expect(toggleShape(squares, square(0))).toHaveLength(STUDY_SQUARES_MAX - 1);
    expect(shapeCounts([...arrows, ...squares])).toEqual({ arrows: STUDY_ARROWS_MAX, squares: STUDY_SQUARES_MAX });
  });
});

describe('study chapters', () => {
  const start = initialPosition('advanced');

  it('starts from a valid FEN only', () => {
    expect(studyStart(toFen(start))).toEqual(start);
    expect(studyStart('not a fen')).toBeNull();
    expect(studyStart(42)).toBeNull();
    expect(studyStart(`${toFen(start)} ${'x'.repeat(300)}`)).toBeNull();
  });

  it('keeps a tree of legal moves and refuses anything else', () => {
    const [first, second] = legalMoves(start).map(moveToString);
    const node = (move: string): StudyRoot & { move: string } => ({ move, comment: '', shapes: [], children: [] });
    const root: StudyRoot = { comment: 'Start', shapes: [square(4)], children: [node(first!), node(second!)] };
    expect(parseStudyRoot(start, root)).toEqual(root);
    expect(parseStudyRoot(start, emptyRoot())).toEqual(emptyRoot());
    expect(parseStudyRoot(start, { ...root, children: [node('zz-not-a-move')] })).toBeNull();
    // The same move twice under one parent is refused.
    expect(parseStudyRoot(start, { ...root, children: [node(first!), node(first!)] })).toBeNull();
    expect(parseStudyRoot(start, { ...root, shapes: Array.from({ length: STUDY_SQUARES_MAX + 1 }, (_, i) => square(i)) })).toBeNull();
    expect(parseStudyRoot(start, 'root')).toBeNull();
  });

  it('measures a chapter against its limits', () => {
    const moves = (count: number): StudyRoot => ({ ...emptyRoot(), children: Array.from({ length: count }, () => ({ ...emptyRoot(), move: 'x' })) });
    expect(chapterFits(emptyRoot())).toBe(true);
    expect(chapterFits(moves(STUDY_NODES_MAX - 1))).toBe(true);
    expect(chapterFits(moves(STUDY_NODES_MAX + 1))).toBe(false);
  });
});
