import { mateDistance } from '@ligungi/bot';
import { legalMoves, parseFen, positionProblems, toFen } from '@ligungi/engine';
import { LESSON_EXERCISES, LESSON_STAGES, lessonDone, lessonStars, playLesson, startLesson, type LessonExercise } from '@ligungi/protocol';
import { describe, expect, it } from 'vitest';

/** Fewest moves that reach a non-mate goal, by breadth-first search over the player's moves (the opponent stays still). */
const shortest = (exercise: LessonExercise, limit: number): number | null => {
  const start = startLesson(exercise);
  const player = start.position.turn;
  let frontier = [start];
  const seen = new Set<string>();
  for (let depth = 0; depth <= limit; depth++) {
    if (frontier.some((state) => lessonDone(exercise, state, player))) return depth;
    const next = [];
    for (const state of frontier) {
      for (const move of legalMoves(state.position)) {
        const after = playLesson(exercise, state, move);
        const key = `${toFen(after.position)}|${[...after.collected].sort().join()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(after);
      }
    }
    frontier = next;
  }
  return null;
};

describe('lessons', () => {
  it('has unique exercises in every stage', () => {
    expect(new Set(LESSON_EXERCISES.map((exercise) => exercise.id)).size).toBe(LESSON_EXERCISES.length);
    for (const stage of LESSON_STAGES) expect(stage.exercises.length).toBeGreaterThan(0);
  });

  it('gives each exercise a goal reachable in exactly its par', () => {
    for (const exercise of LESSON_EXERCISES) {
      const position = parseFen(exercise.fen);
      if (exercise.goal.kind === 'mate') {
        expect(positionProblems(position), exercise.id).toEqual([]);
        expect(mateDistance(position, exercise.goal.moves), exercise.id).toBe(exercise.goal.moves);
        expect(exercise.par, exercise.id).toBe(exercise.goal.moves);
      } else {
        expect(shortest(exercise, exercise.par + 1), exercise.id).toBe(exercise.par);
      }
    }
  });

  it('scores stars by moves over par, and by mistakes in mates', () => {
    const targets = LESSON_EXERCISES.find((exercise) => exercise.id === 'pieces-general')!;
    expect([3, 4, 5, 6].map((moves) => lessonStars(targets, moves, 0))).toEqual([3, 2, 2, 1]);
    const mate = LESSON_EXERCISES.find((exercise) => exercise.goal.kind === 'mate')!;
    expect([0, 1, 2, 5].map((mistakes) => lessonStars(mate, 1, mistakes))).toEqual([3, 2, 1, 1]);
  });
});
