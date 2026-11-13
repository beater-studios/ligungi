import { MODES, type Mode } from '@ligungi/engine';
import { RATING_BAND, type Leaderboard, type PlayersView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { RatingChart } from '../components/RatingChart.tsx';
import { RadioGroup } from '../components/ui.tsx';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { Leaderboards } from './RankingPage.tsx';

const REFRESH_MS = 30_000;

/** Players page: who is online, site counts, the best of each mode and where ratings stand. */
export const PlayersPage = () => {
  const t = useT();
  const [view, setView] = useState<PlayersView | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<PlayersView>('/api/players')
        .then((next) => alive && setView(next))
        .catch((err: Error) => alive && setError(err.message));
    void load();
    api.get<Leaderboard>('/api/leaderboard').then((next) => alive && setBoard(next)).catch(() => {});
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // The viewer's own mode first; otherwise the mode with the most rated players.
  const shown: Mode =
    mode ??
    (view && MODES.find((m) => view.you?.[m] !== undefined)) ??
    (view ? [...MODES].sort((a, b) => total(view, b) - total(view, a))[0]! : 'advanced');

  return (
    <main class="page-menu">
      <nav class="page-menu__menu subnav">
        <a class="active" href="/players">
          {t.players.title}
        </a>
        <a href="/ranking">{t.nav.players}</a>
        <a href="/friends">{t.nav.friends}</a>
      </nav>
      <div class="page-menu__content box">
        <h1 class="box__top">{t.players.title}</h1>
        {error && <p class="box__pad error">{error}</p>}
        {!view && !error && <p class="box__pad ligungi-notice">{t.common.loading}</p>}
        {view && (
          <>
            <ul class="box__pad ligungi-stats">
              <li>
                <strong>{view.counts.online}</strong> {t.players.online}
              </li>
              <li>
                <a href="/tv">
                  <strong>{view.counts.playing}</strong> {t.players.playing}
                </a>
              </li>
              <li>
                <strong>{view.counts.gamesLastDay}</strong> {t.players.gamesLastDay}
              </li>
              <li>
                <strong>{view.counts.gamesTotal}</strong> {t.players.gamesTotal}
              </li>
              <li>
                <strong>{view.counts.players}</strong> {t.players.accounts}
              </li>
            </ul>

            <div class="box__pad community ligungi-players">
              <section class="community__online">
                <h2>{t.players.onlineTitle}</h2>
                {view.online.length === 0 ? (
                  <p class="ligungi-notice">{t.players.onlineEmpty}</p>
                ) : (
                  <ul>
                    {view.online.map((player) => (
                      <li key={player.user.id}>
                        <a class="user-link online" href={`/@/${player.user.name}`}>
                          <i class="line" />
                          {player.user.name}
                        </a>
                        {player.rating !== null && player.mode && (
                          <span class="ligungi-players__rating" title={t.modes[player.mode]}>
                            {player.rating}
                            {player.provisional ? '?' : ''}
                          </span>
                        )}
                        {player.playing && (
                          <a class="ligungi-players__watch" href={`/${player.playing}`} data-icon={icons.Eye}>
                            {t.players.watch}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section class="community__leaders">
                <h2>{t.players.leadersTitle}</h2>
                {board ? <Leaderboards board={board} /> : <p class="ligungi-notice">{t.common.loading}</p>}
              </section>
            </div>

            <section class="box__pad ligungi-distribution">
              <h2>{t.players.distributionTitle}</h2>
              <p class="ligungi-notice">{t.players.distributionHelp}</p>
              <RadioGroup
                name="players-mode"
                value={shown}
                options={MODES.map((m) => ({ value: m, label: t.modes[m] }))}
                onChange={setMode}
              />
              {total(view, shown) === 0 ? (
                <p class="ligungi-notice">{t.players.distributionEmpty}</p>
              ) : (
                <>
                  <RatingChart
                    bands={view.distribution[shown]}
                    you={view.you?.[shown] ?? null}
                    label={t.players.chartLabel(t.modes[shown], total(view, shown))}
                  />
                  {view.you?.[shown] !== undefined && (
                    <p>{t.players.yourPosition(view.you[shown]!, percentBelow(view, shown, view.you[shown]!))}</p>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const total = (view: PlayersView, mode: Mode): number => view.distribution[mode].reduce((sum, band) => sum + band.players, 0);

/** Share of the mode's rated players in lower bands than the given rating (the viewer's own band does not count). */
const percentBelow = (view: PlayersView, mode: Mode, rating: number): number => {
  const all = total(view, mode);
  const own = Math.floor(rating / RATING_BAND) * RATING_BAND;
  const below = view.distribution[mode].filter((band) => band.from < own).reduce((sum, band) => sum + band.players, 0);
  return all === 0 ? 0 : Math.round((below / all) * 100);
};
