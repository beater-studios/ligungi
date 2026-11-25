import {
  type LobbyView,
} from '@ligungi/protocol';
import { LivePlayer } from '../../components/LivePlayer.tsx';
import { MiniBoard } from '../../components/MiniBoard.tsx';
import { speedText, useT } from '../../i18n/index.ts';
import { icons } from '../../icons.ts';
import { useLiveGames } from '../../liveGames.ts';

/** The strongest live game, following every move with its clocks, as on the TV, and how many are online and playing. */
export const Live = ({ lobby }: { lobby: LobbyView | null }) => {
  const t = useT();
  const { games, since, failed } = useLiveGames();
  const game = games?.[0];
  return (
    <section class="ligungi-card ligungi-home__live">
      <div class="ligungi-home__card-head">
        <h2>{t.home.liveTitle}</h2>
        <a class="text" data-icon={icons.AnalogTv} href="/tv">
          {t.home.tvLink}
        </a>
      </div>
      {game ? (
        <a class="ligungi-home__live-game" href={`/${game.id}`}>
          <LivePlayer game={game} color="black" since={since} />
          <MiniBoard fen={game.fen} />
          <LivePlayer game={game} color="white" since={since} />
          <span class="ligungi-home__live-mode">
            {t.modes[game.mode]} · {speedText(t, game)}
          </span>
        </a>
      ) : (
        <p class="ligungi-notice">{games === null ? (failed ? t.genericError : t.common.loading) : t.home.noTv}</p>
      )}
      <p class="ligungi-home__counters">
        <span>
          <strong class="ligungi-home__online">{lobby?.online ?? 0}</strong> {t.home.online(lobby?.online ?? 0)} ·{' '}
          <strong>{lobby?.playing ?? 0}</strong> {t.home.live}
        </span>
        <a href="/players">{t.home.playersLink}</a>
      </p>
    </section>
  );
};
