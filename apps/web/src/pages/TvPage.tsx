import { MODES, type Mode } from '@ligungi/engine';
import type { GameSummary } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { LivePlayer } from '../components/LivePlayer.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { speedText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLiveGames } from '../liveGames.ts';

const GameCard = ({ game, since, featured = false }: { game: GameSummary; since: number; featured?: boolean }) => {
  const t = useT();
  return (
    <a class={`ligungi-card ligungi-tv-game${featured ? ' ligungi-tv-game--featured' : ''}`} href={`/${game.id}`}>
      {featured && <span class="ligungi-tv-game__label">{t.tv.featured}</span>}
      <LivePlayer game={game} color="black" since={since} />
      <MiniBoard fen={game.fen} />
      <LivePlayer game={game} color="white" since={since} />
      <span class="ligungi-tv-game__meta">
        {[t.modes[game.mode], speedText(t, game), game.rated ? t.rated : t.casual, t.tv.move(game.plies)].join(' · ')}
      </span>
    </a>
  );
};

/** Games in progress, followed live: the strongest one large, the rest in a grid, with a filter by mode and a link to its channel. */
export const TvPage = () => {
  const t = useT();
  const { games, since, failed } = useLiveGames();
  const [mode, setMode] = useState<Mode | null>(null);

  // The server sends the strongest games first, so the first one shown is the featured one.
  const shown = (games ?? []).filter((game) => mode === null || game.mode === mode);
  const [featured, ...rest] = shown;

  return (
    <main class="ligungi-page ligungi-tv">
      <header class="ligungi-tv__head">
        <h1>
          {t.tv.title}
          {games !== null && games.length > 0 && <span class="ligungi-live-badge">{t.tv.liveCount(games.length)}</span>}
        </h1>
        <div class="ligungi-segmented ligungi-tv__modes" role="group" aria-label={t.common.mode}>
          {([null, ...MODES] as const).map((m) => (
            <button key={m ?? 'all'} type="button" class={m === mode ? 'active' : ''} aria-pressed={m === mode} onClick={() => setMode(m)}>
              {m === null ? t.tv.all : t.modes[m]}
            </button>
          ))}
        </div>
        <a class="button button-empty text" href={`/tv/${mode ?? 'best'}`} data-icon={icons.AnalogTv}>
          {t.tv.openChannel}
        </a>
      </header>
      {games === null && <p class="ligungi-notice">{failed ? t.genericError : t.common.loading}</p>}
      {games !== null && !featured && <p class="ligungi-card ligungi-tv__empty">{games.length === 0 ? t.tv.empty : t.tv.emptyMode}</p>}
      {featured && (
        <div class="ligungi-tv__body">
          <GameCard game={featured} since={since} featured />
          {rest.length > 0 && (
            <div class="ligungi-tv__grid">
              {rest.map((game) => (
                <GameCard key={game.id} game={game} since={since} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
};
