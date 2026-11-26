import { PUZZLE_RUN_KINDS, type PuzzleDashboard, type RatingPoint } from '@ligungi/protocol';
import { PUZZLE_THEMES } from '@ligungi/content';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { RatingHistoryChart } from '../players/RatingHistoryChart.tsx';
import { formatDate, useT } from '../i18n/index.ts';
import { runRecords, usePuzzleRuns } from '../puzzles/puzzleRuns.ts';
import { Records } from '../puzzles/Records.tsx';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';

const RECENT = 20;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** A player's puzzle rating over time, how they do in each theme, and their latest tries. */
export const PuzzleDashboardPage = () => {
  const t = useT();
  const { user, loaded } = useStore(session);
  const [dashboard, setDashboard] = useState<PuzzleDashboard | null>(null);
  const runs = usePuzzleRuns().view;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<PuzzleDashboard>('/api/puzzles/dashboard')
      .then(setDashboard)
      .catch((err: Error) => setError(err.message));
  }, [user?.id]);

  if (loaded && !user) {
    return (
      <main class="ligungi-page">
        <h1>{t.puzzles.dashboard}</h1>
        <p>
          <a href="/login">{t.puzzles.loginForDashboard}</a>
        </p>
      </main>
    );
  }
  if (!dashboard) {
    return (
      <main class="ligungi-page">
        <p class={error ? 'error' : 'ligungi-notice'}>{error ?? t.common.loading}</p>
      </main>
    );
  }

  const points: RatingPoint[] = dashboard.history.map((entry) => ({ gameId: entry.id, at: entry.at, rating: entry.rating, change: entry.change }));
  const wins = dashboard.history.filter((entry) => entry.win).length;
  const recent = [...dashboard.history].reverse().slice(0, RECENT);
  const themes = PUZZLE_THEMES.filter((theme) => dashboard.themes[theme]);

  return (
    <main class="ligungi-page ligungi-puzzle-dashboard">
      <header class="ligungi-puzzle-dashboard__head">
        <h1>{t.puzzles.dashboard}</h1>
        <a class="button" href="/puzzles">
          {t.puzzles.train}
        </a>
      </header>
      <section class="ligungi-card ligungi-puzzle-dashboard__rating">
        <strong>
          {dashboard.rating.rating}
          {dashboard.rating.provisional ? '?' : ''}
        </strong>
        <span>{t.puzzles.ratingSummary(dashboard.rating.games, dashboard.history.length ? Math.round((wins / dashboard.history.length) * 100) : 0)}</span>
      </section>
      {runs && (
        <div class="ligungi-puzzle-dashboard__runs">
          {PUZZLE_RUN_KINDS.map((kind) => (
            <section key={kind} class="ligungi-card ligungi-game-info ligungi-run">
              <h2>
                <a href={`/${kind}`}>{t.puzzleRuns[kind]}</a>
              </h2>
              <Records records={runRecords(runs, kind)} />
            </section>
          ))}
        </div>
      )}
      {points.length > 0 ? (
        <section class="ligungi-card ligungi-puzzle-dashboard__chart">
          <h2>{t.puzzles.ratingOverTime}</h2>
          <RatingHistoryChart points={points} label={t.puzzles.ratingOverTime} />
        </section>
      ) : (
        <p class="ligungi-card ligungi-tv__empty">{t.puzzles.noTries}</p>
      )}
      {themes.length > 0 && (
        <section class="ligungi-card ligungi-puzzle-dashboard__themes">
          <h2>{t.puzzles.byTheme}</h2>
          <table class="slist">
            <thead>
              <tr>
                <th>{t.puzzles.theme}</th>
                <th>{t.puzzles.tries}</th>
                <th>{t.puzzles.winRate}</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => {
                const { tries, wins: won } = dashboard.themes[theme]!;
                const rate = Math.round((won / tries) * 100);
                return (
                  <tr key={theme}>
                    <td>
                      <a href={`/puzzles?theme=${theme}`}>{t.puzzles.themes[theme]}</a>
                    </td>
                    <td>{tries}</td>
                    <td>
                      <span class="ligungi-puzzle-dashboard__bar" style={{ '--rate': `${rate}%` }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {recent.length > 0 && (
        <section class="ligungi-card ligungi-puzzle-dashboard__recent">
          <h2>{t.puzzles.recent}</h2>
          <ul>
            {recent.map((entry) => (
              <li key={entry.id}>
                <a href={`/puzzles/${entry.id}`}>#{entry.id}</a>
                <span class={entry.win ? 'is-up' : 'is-down'}>{entry.win ? t.puzzles.solvedTag : t.puzzles.failedTag}</span>
                <span>
                  {entry.rating} ({signed(entry.change)})
                </span>
                <span>{formatDate(t, entry.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};
