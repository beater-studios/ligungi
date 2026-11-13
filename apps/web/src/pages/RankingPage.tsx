import { MODES, type Mode } from '@ligungi/engine';
import { LEADERBOARD_MAX, type LeaderEntry, type Leaderboard } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';

const UserLink = ({ entry }: { entry: LeaderEntry }) => (
  <a class={`user-link ${entry.online ? 'online' : 'offline'}`} href={`/@/${entry.user.name}`}>
    <i class="line" />
    {entry.user.name}
  </a>
);

/** The top players of every mode, as lila's leaderboard boxes. Also used on the players page. */
export const Leaderboards = ({ board }: { board: Leaderboard }) => {
  const t = useT();
  return (
    <div class="leaderboards">
      {MODES.map((mode) => (
        <div key={mode} class="user-top">
          <h2 class="text" data-icon={icons.Trophy}>
            <a href={`/ranking/${mode}`}>{t.modes[mode]}</a>
          </h2>
          <ol>
            {board[mode].length === 0 && <li class="ligungi-notice">{t.ranking.empty}</li>}
            {board[mode].map((entry) => (
              <li key={entry.user.id}>
                <UserLink entry={entry} />
                <span>{entry.rating}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
};

const Overview = ({ board }: { board: Leaderboard }) => (
  <div class="community ligungi-ranking">
    <div class="community__leaders">
      <Leaderboards board={board} />
    </div>
  </div>
);

const ModeTable = ({ list }: { list: readonly LeaderEntry[] }) => {
  const t = useT();
  if (list.length === 0) return <p class="box__pad ligungi-notice">{t.ranking.empty}</p>;
  return (
    <table class="slist slist-pad ligungi-leaders">
      <thead>
        <tr>
          <th>#</th>
          <th>{t.ranking.player}</th>
          <th>{t.ranking.rating}</th>
          <th>{t.ranking.games}</th>
        </tr>
      </thead>
      <tbody>
        {list.map((entry, index) => (
          <tr key={entry.user.id}>
            <td class="ligungi-leaders__rank">{index + 1}</td>
            <td>
              <UserLink entry={entry} />
            </td>
            <td>
              <strong>{entry.rating}</strong>
            </td>
            <td>{entry.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const RankingPage = ({ mode }: { mode?: Mode }) => {
  const t = useT();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [list, setList] = useState<LeaderEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (mode) {
      setList(null);
      api.get<LeaderEntry[]>(`/api/leaderboard/${mode}`).then(setList).catch((err: Error) => setError(err.message));
    } else {
      api.get<Leaderboard>('/api/leaderboard').then(setBoard).catch((err: Error) => setError(err.message));
    }
  }, [mode]);

  return (
    <main class="page-menu">
      <nav class="page-menu__menu subnav">
        <a class={mode ? '' : 'active'} href="/ranking">
          {t.ranking.overview}
        </a>
        {MODES.map((m) => (
          <a key={m} class={m === mode ? 'active' : ''} href={`/ranking/${m}`}>
            {t.modes[m]}
          </a>
        ))}
      </nav>
      <div class="page-menu__content box">
        <h1 class="box__top">{mode ? `${t.modes[mode]} · ${t.ranking.top(LEADERBOARD_MAX)}` : t.ranking.title}</h1>
        <p class="box__pad ligungi-notice">{t.ranking.rule}</p>
        {error && <p class="box__pad error">{error}</p>}
        {!error && (mode ? list && <ModeTable list={list} /> : board && <div class="box__pad"><Overview board={board} /></div>)}
        {!error && (mode ? !list : !board) && <p class="box__pad ligungi-notice">{t.common.loading}</p>}
      </div>
    </main>
  );
};
