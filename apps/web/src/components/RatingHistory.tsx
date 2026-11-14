import { MODES, type Mode } from '@ligungi/engine';
import { GAME_LENGTHS, type ModeRecord, type ModeStats, type UserProfile } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { formatDate, useT } from '../i18n/index.ts';
import { RatingHistoryChart } from './RatingHistoryChart.tsx';

/** Rows of the table view: the latest games, newest first. */
const TABLE_ROWS = 50;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Wins, draws and losses as a bar and in words, the way the rating cards show them. */
const RecordRow = ({ label, record }: { label: string; record: ModeRecord }) => {
  const t = useT();
  const total = record.wins + record.draws + record.losses;
  const share = (n: number) => `${(n / total) * 100}%`;
  return (
    <div class="ligungi-history__record">
      <span class="ligungi-history__record-label">{label}</span>
      {total > 0 ? (
        <>
          <span class="ligungi-rating-card__bar" aria-hidden="true">
            <span class="win" style={{ width: share(record.wins) }} />
            <span class="draw" style={{ width: share(record.draws) }} />
            <span class="loss" style={{ width: share(record.losses) }} />
          </span>
          <span class="ligungi-history__record-text">{t.profile.record(record.wins, record.draws, record.losses)}</span>
        </>
      ) : (
        <span class="ligungi-history__record-text">{t.profile.noGamesHere}</span>
      )}
    </div>
  );
};

/**
 * The profile's rating history: one mode at a time (the most played first), its chart, peak and lowest rating, and the
 * results by color and by game length, with the points as a table for those who cannot see the chart.
 */
export const RatingHistory = ({ profile }: { profile: UserProfile }) => {
  const t = useT();
  const played = MODES.filter((mode) => profile.ratings[mode].games > 0);
  const mostPlayed = [...played].sort((a, b) => profile.ratings[b].games - profile.ratings[a].games)[0];
  const [mode, setMode] = useState<Mode | undefined>(mostPlayed);
  const [stats, setStats] = useState<ModeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = profile.user.name;

  useEffect(() => setMode(mostPlayed), [name]);
  useEffect(() => {
    if (!mode) return;
    setStats(null);
    setError(null);
    api
      .get<ModeStats>(`/api/users/${encodeURIComponent(name)}/stats/${mode}`)
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, [name, mode]);

  if (!mode) return null;
  const history = stats?.history ?? [];
  const lengthLabel = (index: number) => {
    const upTo = GAME_LENGTHS[index];
    const previous = index > 0 ? GAME_LENGTHS[index - 1]! : null;
    if (upTo === null || upTo === undefined) return t.profile.lengthOver(previous ?? 0);
    return previous === null ? t.profile.lengthUpTo(upTo) : t.profile.lengthBetween(previous + 1, upTo);
  };

  return (
    <section class="ligungi-card ligungi-history">
      <header class="ligungi-history__head">
        <h2>{t.profile.historyTitle}</h2>
        {played.length > 1 && (
          <div class="ligungi-segmented" role="group" aria-label={t.common.mode}>
            {played.map((m) => (
              <button key={m} type="button" class={m === mode ? 'active' : ''} aria-pressed={m === mode} onClick={() => setMode(m)}>
                {t.modes[m]}
              </button>
            ))}
          </div>
        )}
      </header>
      {error && <p class="error">{error}</p>}
      {!stats && !error && <p class="ligungi-notice">{t.common.loading}</p>}
      {stats && (
        <>
          <RatingHistoryChart
            points={history}
            label={t.profile.chartLabel(
              t.modes[mode],
              history.length,
              history[0]?.rating ?? 0,
              history[history.length - 1]?.rating ?? 0,
              stats.peak?.rating ?? 0,
            )}
          />
          <dl class="ligungi-history__figures">
            <div>
              <dt>{t.profile.current}</dt>
              <dd>{profile.ratings[mode].rating}</dd>
            </div>
            {stats.peak && (
              <div>
                <dt>{t.profile.peak}</dt>
                <dd>
                  {stats.peak.rating} <small>{formatDate(t, stats.peak.at)}</small>
                </dd>
              </div>
            )}
            {stats.lowest && (
              <div>
                <dt>{t.profile.lowest}</dt>
                <dd>
                  {stats.lowest.rating} <small>{formatDate(t, stats.lowest.at)}</small>
                </dd>
              </div>
            )}
            <div>
              <dt>{t.profile.ratedGamesLabel}</dt>
              <dd>{history.length}</dd>
            </div>
          </dl>
          <div class="ligungi-history__records">
            <div>
              <h3>{t.profile.byColor}</h3>
              <RecordRow label={t.profile.asWhite} record={stats.byColor.white} />
              <RecordRow label={t.profile.asBlack} record={stats.byColor.black} />
            </div>
            <div>
              <h3>{t.profile.byLength}</h3>
              {stats.byLength.map((record, index) => (
                <RecordRow key={index} label={lengthLabel(index)} record={record} />
              ))}
            </div>
          </div>
          {history.length > 0 && (
            <details class="ligungi-history__table">
              <summary>{t.profile.showTable}</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.profile.date}</th>
                    <th scope="col">{t.profile.ratingColumn}</th>
                    <th scope="col">{t.profile.change}</th>
                    <th scope="col">{t.profile.game}</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice(-TABLE_ROWS)
                    .reverse()
                    .map((point) => (
                      <tr key={point.gameId}>
                        <td>{formatDate(t, point.at)}</td>
                        <td>{point.rating}</td>
                        <td>{signed(point.change)}</td>
                        <td>
                          <a href={`/${point.gameId}`}>{point.gameId}</a>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </section>
  );
};
