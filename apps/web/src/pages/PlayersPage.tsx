import { MODES, type Mode } from '@ligungi/engine';
import { RATING_BAND, type OnlinePlayer, type PlayersView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { CreateGame } from '../game/CreateGame.tsx';
import { Flag } from '../players/Flag.tsx';
import { RatingChart } from '../players/RatingChart.tsx';
import { Checkbox, Select } from '../components/ui.tsx';
import { playerName, timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { usePolling } from '../core/hooks.ts';
import { CommunityNav } from '../players/CommunityNav.tsx';

const REFRESH_MS = 30_000;

const total = (view: PlayersView, mode: Mode): number => view.distribution[mode].reduce((sum, band) => sum + band.players, 0);

/** Share of the mode's rated players in lower bands than the given rating (the viewer's own band does not count). */
const percentBelow = (view: PlayersView, mode: Mode, rating: number): number => {
  const all = total(view, mode);
  const own = Math.floor(rating / RATING_BAND) * RATING_BAND;
  const below = view.distribution[mode].filter((band) => band.from < own).reduce((sum, band) => sum + band.players, 0);
  return all === 0 ? 0 : Math.round((below / all) * 100);
};

const OnlineRow = ({ player, mode, me, onChallenge }: { player: OnlinePlayer; mode: Mode; me: string | null; onChallenge: (name: string) => void }) => {
  const t = useT();
  const standing = player.ratings[mode];
  const rating = standing ? `${standing.rating}${standing.provisional ? '?' : ''}` : '';
  const rank = standing?.rank ? `#${standing.rank}` : '';
  const status = player.playing ? t.players.playing : t.players.free;
  return (
    <li class={`ligungi-online-row${player.playing ? ' ligungi-online-row--playing' : ''}`}>
      <span class="ligungi-online-row__player">
        <a class="user-link online" href={`/@/${player.user.name}`}>
          <i class="line" />
          {player.user.name}
        </a>
        <Flag country={player.country} />
        {player.user.id === me && <span class="ligungi-tag">{t.players.you}</span>}
        {player.followed && <span class="ligungi-tag">{t.players.followed}</span>}
      </span>
      <span class="ligungi-online-row__rating">
        <strong>{rating || '·'}</strong> <span class="ligungi-online-row__rank">{rank}</span>
      </span>
      <span class="ligungi-online-row__games">{standing?.games ?? 0}</span>
      <span class="ligungi-online-row__status">{status}</span>
      {/* Phones: rating, position and status on one line under the name. */}
      <span class="ligungi-online-row__meta">
        {[rating && `${rating} ${rank}`.trim(), status].filter(Boolean).join(' · ')}
      </span>
      <span class="ligungi-online-row__action">
        {player.playing ? (
          <a class="button" href={`/${player.playing}`}>
            {t.players.watch}
          </a>
        ) : player.canChallenge ? (
          <button type="button" class="button ligungi-button-good" onClick={() => onChallenge(player.user.name)}>
            {t.profile.challenge}
          </button>
        ) : null}
      </span>
    </li>
  );
};

/** Players page: who is online to play with, the site's numbers and where the viewer's rating stands. */
/** The latest finished games and the newest accounts, so the site shows life even with few players online. */
const RecentActivity = ({ recent }: { recent: PlayersView['recent'] }) => {
  const t = useT();
  return (
    <section class="ligungi-card ligungi-players__recent">
      <h2>{t.players.recentTitle}</h2>
      <h3>{t.players.recentGames}</h3>
      {recent.games.length === 0 ? (
        <p class="ligungi-notice">{t.players.noRecentGames}</p>
      ) : (
        <ul>
          {recent.games.map((game) => {
            const winner = game.outcome?.winner;
            return (
              <li key={game.id}>
                <a href={`/${game.id}`}>
                  {playerName(t, game.players.white)} × {playerName(t, game.players.black)}
                </a>
                <span class="ligungi-players__recent-meta">
                  {winner ? t.players.recentWinner(playerName(t, game.players[winner])) : t.players.recentDraw} · {t.modes[game.mode]} ·{' '}
                  {timeAgo(t, game.endedAt ?? game.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {recent.players.length > 0 && (
        <>
          <h3>{t.players.recentPlayers}</h3>
          <ul class="ligungi-players__recent-people">
            {recent.players.map((player) => (
              <li key={player.user.id}>
                <span>
                  <a href={`/@/${player.user.name}`}>{player.user.name}</a> <Flag country={player.country} />
                </span>
                <span class="ligungi-players__recent-meta">{timeAgo(t, player.joinedAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export const PlayersPage = () => {
  const t = useT();
  const { user } = useStore(session);
  const [view, setView] = useState<PlayersView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const [query, setQuery] = useState('');
  const [challenging, setChallenging] = useState<string | null>(null);

  usePolling(
    (alive) =>
      api
        .get<PlayersView>('/api/players')
        .then((next) => alive() && setView(next))
        .catch((err: Error) => alive() && setError(err.message)),
    REFRESH_MS,
    [user?.id],
  );

  // The viewer's own mode first; otherwise the mode with the most rated players.
  const shown: Mode =
    mode ??
    (view && MODES.find((m) => view.you?.[m] !== undefined)) ??
    (view ? [...MODES].sort((a, b) => total(view, b) - total(view, a))[0]! : 'advanced');

  const needle = query.trim().toLowerCase();
  const list = (view?.online ?? []).filter(
    (player) =>
      (!onlyFree || !player.playing) &&
      (!onlyFollowed || !user || player.followed) &&
      (!needle || player.user.name.toLowerCase().includes(needle)),
  );
  const yours = view?.you?.[shown];

  return (
    <main class="ligungi-page ligungi-players">
      <CommunityNav active="players" />
      {!view && <h1 class="ligungi-sr-only">{t.nav.playerList}</h1>}
      {error && <p class="error">{error}</p>}
      {!view && !error && <p class="ligungi-notice">{t.common.loading}</p>}
      {view && (
        <>
          <section class="ligungi-card ligungi-players__hero">
            <div class="ligungi-players__intro">
              <h1>{t.players.heroTitle(view.counts.signedIn, view.counts.free)}</h1>
              <p>{t.players.heroText(view.counts.playing)}</p>
            </div>
            <div class="ligungi-players__cta">
              <a class="button ligungi-button-good" href="/">
                {t.players.quickGame}
              </a>
              <a class="button button-empty" href="/?create=lobby">
                {t.nav.createGame}
              </a>
              <a class="button button-empty" href="/computer">
                {t.nav.playComputer}
              </a>
            </div>
          </section>

          <div class="ligungi-players__body">
            <section class="ligungi-card ligungi-players__online">
              <div class="ligungi-players__filters">
                <h2>{t.players.onlineTitle}</h2>
                <Select
                  ariaLabel={t.players.ratingOf}
                  value={shown}
                  options={MODES.map((m) => ({ value: m, label: `${t.players.ratingOf} ${t.modes[m]}` }))}
                  onChange={setMode}
                />
                <Checkbox id="pl-free" checked={onlyFree} label={t.players.onlyFree} onChange={setOnlyFree} />
                {user && <Checkbox id="pl-followed" checked={onlyFollowed} label={t.players.onlyFollowed} onChange={setOnlyFollowed} />}
                <input
                  class="form-control"
                  type="search"
                  placeholder={t.players.search}
                  aria-label={t.players.search}
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                />
              </div>
              {view.online.length === 0 ? (
                <p class="ligungi-notice ligungi-players__empty">{t.players.onlineEmpty}</p>
              ) : list.length === 0 ? (
                <p class="ligungi-notice ligungi-players__empty">{t.players.noMatch}</p>
              ) : (
                <ul class="ligungi-online-list">
                  <li class="ligungi-online-row ligungi-online-row--head" aria-hidden="true">
                    <span>{t.players.player}</span>
                    <span>
                      {t.players.rating} · {t.modes[shown]}
                    </span>
                    <span>{t.players.games}</span>
                    <span>{t.players.status}</span>
                    <span />
                  </li>
                  {list.map((player) => (
                    <OnlineRow key={player.user.id} player={player} mode={shown} me={user?.id ?? null} onChallenge={setChallenging} />
                  ))}
                </ul>
              )}
            </section>

            <aside class="ligungi-players__side">
              <section class="ligungi-card ligungi-players__site">
                <h2>{t.players.siteNow}</h2>
                <dl>
                  <dt>{t.players.statOnline}</dt>
                  <dd>{view.counts.online}</dd>
                  <dt>{t.players.statPlaying}</dt>
                  <dd>
                    <a href="/tv">{view.counts.playing}</a>
                  </dd>
                  <dt>{t.players.statLastDay}</dt>
                  <dd>{view.counts.gamesLastDay}</dd>
                  <dt>{t.players.statFinished}</dt>
                  <dd>{view.counts.gamesTotal}</dd>
                  <dt>{t.players.statAccounts}</dt>
                  <dd>{view.counts.players}</dd>
                </dl>
              </section>
              <RecentActivity recent={view.recent} />
              <section class="ligungi-card ligungi-players__position">
                <h2>{yours !== undefined ? t.players.positionTitle(t.modes[shown]) : t.players.distributionTitle(t.modes[shown])}</h2>
                {total(view, shown) === 0 ? (
                  <p class="ligungi-notice">{t.players.distributionEmpty}</p>
                ) : (
                  <RatingChart
                    size="compact"
                    bands={view.distribution[shown]}
                    you={yours ?? null}
                    label={t.players.chartLabel(t.modes[shown], total(view, shown))}
                  />
                )}
                {yours !== undefined ? (
                  <p>{t.players.yourPosition(yours, percentBelow(view, shown, yours))}</p>
                ) : (
                  user && <p class="ligungi-notice">{t.players.noRating(t.modes[shown])}</p>
                )}
                <a class="text" data-icon={icons.Trophy} href={`/ranking/${shown}`}>
                  {t.players.viewRanking(t.modes[shown])}
                </a>
              </section>
            </aside>
          </div>
        </>
      )}
      {challenging && <CreateGame target="friend" to={challenging} onClose={() => setChallenging(null)} />}
    </main>
  );
};
