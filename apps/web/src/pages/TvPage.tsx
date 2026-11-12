import type { GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { playerName, timeControlText, useT } from '../i18n/index.ts';

type Player = GameSummary['players']['white'];

const MiniPlayer = ({ player }: { player: Player }) => {
  const t = useT();
  return (
  <span class="mini-game__player">
    <span class="mini-game__user">
      <span class="name">{playerName(t, player)}</span>
      {player.rating !== null && <span class="rating">{player.rating}</span>}
    </span>
  </span>
  );
};

export const TvPage = () => {
  const t = useT();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  useEffect(() => {
    const load = () => api.get<GameSummary[]>('/api/tv').then(setGames).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <main class="page-menu tv-games">
      <nav class="page-menu__menu subnav">
        <a class="active" href="/tv">
          {t.nav.liveGames}
        </a>
      </nav>
      <div class="page-menu__content box">
        <h1 class="box__top">{t.nav.liveGames}</h1>
        {games === null && <p class="box__pad ligungi-notice">{t.common.loading}</p>}
        {games?.length === 0 && <p class="box__pad ligungi-notice">{t.tv.empty}</p>}
        <div class="now-playing box__pad">
          {games?.map((game) => (
            <a key={game.id} class="mini-game" href={`/${game.id}`} title={`${t.modes[game.mode]} · ${timeControlText(t, game.timeControl)}`}>
              <MiniPlayer player={game.players.black} />
              <MiniBoard fen={game.fen} />
              <MiniPlayer player={game.players.white} />
            </a>
          ))}
        </div>
      </div>
    </main>
  );
};
