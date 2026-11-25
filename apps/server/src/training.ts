import type { ActivityEvent } from '@ligungi/protocol';
import type { Db } from './db.ts';

/** A player's lesson and practice progress, kept on the account. */
export class Training {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(db: Db, now: () => number) {
    this.#db = db;
    this.#now = now;
  }

  /** The best stars the player earned in each lesson exercise they finished. */
  lessonProgress(userId: string): Record<string, number> {
    const rows = this.#db.prepare('select exercise_id, stars from lesson_progress where user_id = ?').all(userId) as Array<{ exercise_id: string; stars: number }>;
    return Object.fromEntries(rows.map((row) => [row.exercise_id, row.stars]));
  }

  /** Lessons and practice positions improved since a moment, for the player's own activity. */
  trainingSince(userId: string, since: number): ActivityEvent[] {
    const lessons = this.#db
      .prepare('select stars, updated_at as at from lesson_progress where user_id = ? and updated_at >= ?')
      .all(userId, since) as Array<{ stars: number; at: number }>;
    const practice = this.#db
      .prepare('select updated_at as at from practice_progress where user_id = ? and updated_at >= ?')
      .all(userId, since) as Array<{ at: number }>;
    return [
      ...lessons.map((row): ActivityEvent => ({ kind: 'lesson', at: row.at, stars: row.stars })),
      ...practice.map((row): ActivityEvent => ({ kind: 'practice', at: row.at })),
    ];
  }

  /** Records lesson results, keeping the best stars of each exercise. */
  saveLessonProgress(userId: string, results: Readonly<Record<string, number>>): void {
    const upsert = this.#db.prepare(
      `insert into lesson_progress (user_id, exercise_id, stars, updated_at) values (?, ?, ?, ?)
       on conflict (user_id, exercise_id) do update set stars = max(stars, excluded.stars), updated_at = excluded.updated_at`,
    );
    const now = this.#now();
    for (const [id, stars] of Object.entries(results)) upsert.run(userId, id, stars, now);
  }

  /** The practice positions the player finished, with the fewest moves they needed for each. */
  practiceProgress(userId: string): Record<string, number> {
    const rows = this.#db.prepare('select position_id, moves from practice_progress where user_id = ?').all(userId) as Array<{ position_id: string; moves: number }>;
    return Object.fromEntries(rows.map((row) => [row.position_id, row.moves]));
  }

  /** Records finished practice positions, keeping the fewest moves of each. */
  savePracticeProgress(userId: string, results: Readonly<Record<string, number>>): void {
    const upsert = this.#db.prepare(
      `insert into practice_progress (user_id, position_id, moves, updated_at) values (?, ?, ?, ?)
       on conflict (user_id, position_id) do update set moves = min(moves, excluded.moves), updated_at = excluded.updated_at`,
    );
    const now = this.#now();
    for (const [id, moves] of Object.entries(results)) upsert.run(userId, id, moves, now);
  }
}
