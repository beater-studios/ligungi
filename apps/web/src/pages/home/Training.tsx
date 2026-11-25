import {
  LESSON_STAGES,
  type DailyPuzzle,
  type PuzzleRatingView,
} from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { MiniBoard } from '../../components/MiniBoard.tsx';
import { useT } from '../../i18n/index.ts';
import { useLessonProgress } from '../../lessonProgress.ts';
import { usePuzzleRuns } from '../../puzzleRuns.ts';

/** For a signed-in player: their puzzle rating, Storm and Streak records and how far the lessons go, each a link. */
export const Training = ({ puzzleRating }: { puzzleRating: PuzzleRatingView | null }) => {
  const t = useT();
  const runs = usePuzzleRuns().view;
  const { progress } = useLessonProgress();
  const stagesDone = progress ? LESSON_STAGES.filter((stage) => stage.exercises.every((exercise) => (progress[exercise.id] ?? 0) > 0)).length : null;
  const rows: Array<{ href: string; label: string; value: string | null }> = [
    { href: '/puzzles/dashboard', label: t.home.puzzleRating, value: puzzleRating ? `${puzzleRating.rating}${puzzleRating.provisional ? '?' : ''}` : null },
    { href: '/storm', label: t.home.stormBest, value: runs ? String(runs.best.storm) : null },
    { href: '/streak', label: t.home.streakBest, value: runs ? String(runs.best.streak) : null },
    { href: '/lessons', label: t.home.lessons, value: stagesDone === null ? null : t.home.lessonsDone(stagesDone, LESSON_STAGES.length) },
  ];
  return (
    <section class="ligungi-card ligungi-home__training">
      <h2>{t.home.trainTitle}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.href}>
            <a href={row.href}>
              <span>{row.label}</span>
              <strong>{row.value ?? '-'}</strong>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** The puzzle of the day, the same for everyone: a small board and a link to solve it. */
export const DailyPuzzleCard = () => {
  const t = useT();
  const [daily, setDaily] = useState<DailyPuzzle | null>(null);
  useEffect(() => {
    api.get<DailyPuzzle>('/api/puzzles/daily').then(setDaily).catch(() => {});
  }, []);
  if (!daily) return null;
  const task = daily.kind === 'mate' ? t.puzzles.taskMate(daily.color, daily.moves) : t.puzzles.taskMaterial(daily.color);
  return (
    <section class="ligungi-card ligungi-home__daily">
      <div class="ligungi-home__card-head">
        <h2>{t.home.dailyPuzzle}</h2>
        <a href="/puzzles">{t.nav.puzzles}</a>
      </div>
      <a class="ligungi-home__daily-board" href="/puzzles/daily" aria-label={`${t.home.dailyPuzzle}: ${task}`}>
        <MiniBoard fen={daily.fen} orientation={daily.color} />
      </a>
      <p>{task}</p>
      <a class="button ligungi-home__solve" href="/puzzles/daily">
        {t.home.solveDaily}
      </a>
      <p class="ligungi-home__daily-links">
        <a href="/streak">{t.puzzleRuns.streak}</a>
        <a href="/storm">{t.puzzleRuns.storm}</a>
      </p>
    </section>
  );
};
