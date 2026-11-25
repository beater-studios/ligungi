import { MODES } from '@ligungi/engine';
import {
  type Leaderboard,
} from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../api.ts';
import { RatingTrend } from '../../components/RatingTrend.tsx';
import { useT } from '../../i18n/index.ts';

/** Leaders shown per mode in the home's leaders card. */
const LEADERS_PER_MODE = 2;

/** The best players of each mode, from the leaderboard; it invites rated play while nobody is on it. */
export const Leaders = () => {
  const t = useT();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  useEffect(() => {
    api.get<Leaderboard>('/api/leaderboard').then(setBoard).catch(() => {});
  }, []);
  if (!board) return null;
  const rows = MODES.flatMap((mode) => board[mode].slice(0, LEADERS_PER_MODE).map((entry) => ({ mode, entry })));
  return (
    <section class="ligungi-card ligungi-home__leaders">
      <div class="ligungi-home__card-head">
        <h2>{t.home.leadersTitle}</h2>
        <a href="/ranking">{t.home.rankingLink}</a>
      </div>
      {rows.length === 0 ? (
        <p class="ligungi-notice">{t.home.noLeaders}</p>
      ) : (
        <ul>
          {rows.map(({ mode, entry }) => (
            <li key={`${mode}-${entry.user.id}`}>
              <span class="ligungi-home__leader">
                <a class="ligungi-home__leader-mode" href={`/ranking/${mode}`}>
                  {t.modes[mode]}
                </a>
                <a class={`user-link${entry.online ? ' online' : ''}`} href={`/@/${entry.user.name}`}>
                  <i class="line" />
                  {entry.user.name}
                </a>
              </span>
              <span class="ligungi-home__leader-rating">
                <strong>{entry.rating}</strong>
                <RatingTrend value={entry.trend} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
