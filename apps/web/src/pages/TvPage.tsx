import { MODES, type Color, type Mode } from '@ligungi/engine';
import type { ClockView, GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { formatClock, playerName, speedText, useT } from '../i18n/index.ts';

const REFRESH_MS = 5_000;

/** A clock that keeps ticking between refreshes, from the time left when the list arrived. */
const Clock = ({ clock, color, since }: { clock: ClockView; color: Color; since: number }) => {
  const running = clock.running === color;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [running, since]);
  const left = running ? Math.max(0, clock[color] - (performance.now() - since)) : clock[color];
  return <span class={`ligungi-tv-game__clock${running ? ' is-running' : ''}`}>{formatClock(left)}</span>;
};

const PlayerRow = ({ game, color, since }: { game: GameSummary; color: Color; since: number }) => {
  const t = useT();
  const player = game.players[color];
  return (
    <span class="ligungi-tv-game__player">
      <span class="ligungi-tv-game__name">
        {playerName(t, player)}
        {player.rating !== null && <span class="ligungi-tv-game__rating">{player.rating}</span>}
      </span>
      {game.clock && <Clock clock={game.clock} color={color} since={since} />}
    </span>
  );
};

const GameCard = ({ game, since, featured = false }: { game: GameSummary; since: number; featured?: boolean }) => {
  const t = useT();
  return (
    <a class={`ligungi-card ligungi-tv-game${featured ? ' ligungi-tv-game--featured' : ''}`} href={`/${game.id}`}>
      {featured && <span class="ligungi-tv-game__label">{t.tv.featured}</span>}
      <PlayerRow game={game} color="black" since={since} />
      <MiniBoard fen={game.fen} />
      <PlayerRow game={game} color="white" since={since} />
      <span class="ligungi-tv-game__meta">
        {[t.modes[game.mode], speedText(t, game), game.rated ? t.rated : t.casual, t.tv.move(game.plies)].join(' · ')}
      </span>
    </a>
  );
};

/** Games in progress: the strongest one large, the rest in a grid, with a filter by mode. */
export const TvPage = () => {
  const t = useT();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [since, setSince] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .get<GameSummary[]>('/api/tv')
        .then((list) => {
          setGames(list);
          setSince(performance.now());
        })
        .catch(() => {});
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

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
      </header>
      {games === null && <p class="ligungi-notice">{t.common.loading}</p>}
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
