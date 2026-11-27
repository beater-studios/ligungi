import { ARENA, type ArenaStanding, type ArenaSummary, type ArenaView } from '@ligungi/protocol';
import { useState } from 'preact/hooks';
import { arenaTime, countdown, prizeKey, timeZone, useArena, useNow } from '../arena/arena.ts';
import { Trophy } from '../arena/Trophy.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { api } from '../core/api.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';
import { formatDate, playerName, speedText, useT, type Messages } from '../i18n/index.ts';

const STATE_CLASS = { playing: 'is-playing', waiting: 'is-waiting', away: 'is-away' } as const;

const Fire = ({ label }: { label: string }) => (
  <svg class="ligungi-arena__fire" width="16" height="16" viewBox="0 0 24 24" role="img" aria-label={label}>
    <path d="M12 2c1 3.2 4.5 5.4 4.5 10a4.5 4.5 0 1 1-9 0c0-2.2 1-3.6 2.2-4.6 0 2.1 1 3.3 2.3 3.6C12 8.4 11 5.3 12 2z" />
  </svg>
);

const meta = (t: Messages, view: ArenaView) => [t.modes[view.mode], speedText(t, { timeControl: view.timeControl, daysPerMove: null }), t.rated].join(' · ');

/** The standings: the score sheet while it runs, games and performance once finished, with each trophy. */
const Standings = ({ view, youId }: { view: ArenaView; youId: string | null }) => {
  const t = useT();
  const a = t.arena;
  const running = view.status === 'started';
  return (
    <section class="ligungi-card ligungi-arena__table">
      <table>
        <caption>{running ? a.standings : a.finalStandings}</caption>
        <thead>
          <tr>
            <th scope="col">{a.rank}</th>
            <th scope="col">{a.player}</th>
            {running ? <th scope="col">{a.games}</th> : <th scope="col" class="num">{a.games}</th>}
            {!running && <th scope="col" class="num">{a.performance}</th>}
            <th scope="col" class="num">{a.points}</th>
          </tr>
        </thead>
        <tbody>
          {view.standings.map((s) => (
            <tr key={s.user.id} class={s.user.id === youId ? 'is-you' : ''}>
              <td class="rank">{s.rank}</td>
              <td>
                <span class="ligungi-arena__player">
                  {s.state && <span class={`ligungi-arena__dot ${STATE_CLASS[s.state]}`} title={{ playing: a.statePlaying, waiting: a.stateWaiting, away: a.stateAway }[s.state]} />}
                  <a href={`/@/${s.user.name}`}>{s.user.name}</a>
                  <span class="ligungi-arena__rating">
                    {s.rating}
                    {s.provisional ? '?' : ''}
                  </span>
                  {s.trophy && <Trophy kind={s.trophy} size={22} />}
                </span>
              </td>
              {running ? (
                <td>
                  <span class="ligungi-arena__sheet">
                    {s.sheet.map((entry, i) => (
                      <span key={i} class={entry.doubled ? 'is-double' : entry.points === 0 ? 'is-zero' : ''}>
                        {entry.points}
                      </span>
                    ))}
                  </span>
                </td>
              ) : (
                <td class="num">{s.games}</td>
              )}
              {!running && <td class="num">{s.performance ?? '-'}</td>}
              <td class="num">
                <span class="ligungi-arena__score">
                  {running && s.fire && <Fire label={a.fire} />}
                  <strong>{s.score}</strong>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {running && <p class="ligungi-arena__note">{a.legend}</p>}
    </section>
  );
};

/** The first three places on steps, the champion in the middle and highest. */
const Podium = ({ standings }: { standings: readonly ArenaStanding[] }) => {
  const t = useT();
  const order = [standings[1], standings[0], standings[2]].filter((s): s is ArenaStanding => Boolean(s));
  return (
    <section class="ligungi-arena__podium" aria-label={t.arena.finalStandings}>
      {order.map((s) => (
        <div key={s.user.id} class={`ligungi-arena__step ligungi-arena__step--${s.rank}`}>
          {s.trophy ? <Trophy kind={s.trophy} size={s.rank === 1 ? 96 : s.rank === 2 ? 76 : 60} /> : <span class="ligungi-arena__step-place">{s.rank}</span>}
          <a href={`/@/${s.user.name}`} class="ligungi-arena__step-name">
            {s.user.name}
          </a>
          <div class="ligungi-arena__plinth">
            <strong>{s.score}</strong>
            <span>
              {t.arena.gamesCount(s.games)}
              {s.performance !== null ? ` · ${t.arena.perf(s.performance)}` : ''}
            </span>
            <span>{t.arena.winsCount(s.wins)}</span>
          </div>
        </div>
      ))}
    </section>
  );
};

const RecentList = ({ recent }: { recent: readonly ArenaSummary[] }) => {
  const t = useT();
  if (recent.length === 0) return null;
  return (
    <section class="ligungi-card ligungi-arena__recent">
      <h2>{t.arena.recentTitle}</h2>
      <ul>
        {recent.map((arena) => (
          <li key={arena.id}>
            <a href={`/arena/${arena.id}`}>
              <span>{formatDate(t, arena.startsAt)}</span>
              <span>{arena.status === 'canceled' ? t.arena.statusCanceled : t.arena.playersCount(arena.players)}</span>
              <span>{arena.winner ? t.arena.winner(arena.winner.name) : ''}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * The weekly Arena: before the start, a countdown with the join button and who joined; while it runs, the standings
 * live with the viewer's status and the games in progress; once over, the podium and the final standings. `/arena` shows
 * the one running or the next, with the previous ones below.
 */
export const ArenaPage = ({ id }: { id?: string }) => {
  const t = useT();
  const a = t.arena;
  const { user } = useStore(session);
  const { view, setView, recent, missing } = useArena(id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(view !== null && (view.status === 'created' || view.status === 'started'));

  // Before the data arrives (and in the prerendered page crawlers read), what the Arena is and how it works.
  if (!view) {
    return (
      <main class="ligungi-page ligungi-arena">
        <section class="ligungi-card ligungi-arena__head">
          <div class="ligungi-arena__title">
            <Trophy kind="arenaChampion" size={44} />
            <h1>{a.title}</h1>
          </div>
        </section>
        <p class="ligungi-notice">{missing ? t.errors.arenaNotFound : t.common.loading}</p>
        <section class="ligungi-card ligungi-arena__how">
          <h2>{a.howTitle}</h2>
          <ul>
            {a.how.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        {!id && <RecentList recent={recent} />}
      </main>
    );
  }

  const act = async (action: 'join' | 'pause') => {
    setBusy(true);
    setError(null);
    try {
      setView(await api.post<ArenaView>(`/api/arena/${view.id}/${action}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const you = view.you;
  const joinedCount = view.standings.length;
  const header = (
    <section class="ligungi-card ligungi-arena__head">
      <div class="ligungi-arena__title">
        <Trophy kind="arenaChampion" size={44} />
        <div>
          <h1>{view.status === 'finished' || view.status === 'canceled' ? a.heading(formatDate(t, view.startsAt)) : a.title}</h1>
          <span class="ligungi-arena__meta">
            {meta(t, view)}
            {view.status === 'finished' ? ` · ${a.statusFinished} · ${a.playersCount(view.players)}` : view.status === 'canceled' ? ` · ${a.statusCanceled}` : ''}
          </span>
        </div>
      </div>
      {view.status === 'started' && view.endsAt !== null && (
        <div class="ligungi-arena__clock">
          <span>{a.endsIn}</span>
          <strong>{countdown(view.endsAt - now)}</strong>
        </div>
      )}
    </section>
  );

  if (view.status === 'created') {
    const late = now >= view.startsAt;
    return (
      <main class="ligungi-page ligungi-arena">
        <div class="ligungi-arena__layout">
          <aside class="ligungi-arena__aside">
            <section class="ligungi-card ligungi-arena__info">
              <div class="ligungi-arena__title">
                <Trophy kind="arenaChampion" size={44} />
                <div>
                  <h1>{a.title}</h1>
                  <span class="ligungi-arena__meta">{meta(t, view)}</span>
                </div>
              </div>
              <dl>
                <dt>{a.startLabel}</dt>
                <dd>{arenaTime(t, view.startsAt)}</dd>
                <dt>{a.durationLabel}</dt>
                <dd>{a.minutes(view.durationMinutes)}</dd>
                <dt>{a.seasonLabel}</dt>
                <dd>{view.season === 'S0' ? a.seasonZero : view.season}</dd>
              </dl>
              <p class="ligungi-arena__note">{a.timezone(timeZone())}</p>
            </section>
            <section class="ligungi-card ligungi-arena__how">
              <h2>{a.howTitle}</h2>
              <ul>
                {a.how.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </aside>
          <div class="ligungi-arena__main">
            <section class="ligungi-card ligungi-arena__countdown">
              <div>
                <span class="ligungi-arena__label">{a.startsIn}</span>
                <strong>{countdown(view.startsAt - now)}</strong>
              </div>
              <div class="ligungi-arena__cta">
                {user ? (
                  <button type="button" class={you?.joined ? 'button button-empty' : 'button'} disabled={busy} onClick={() => void act(you?.joined ? 'pause' : 'join')}>
                    {you?.joined ? a.leave : a.join}
                  </button>
                ) : (
                  <p>{a.loginToJoin}</p>
                )}
                {you?.joined && <span class="ligungi-arena__note">{a.joinedNote}</span>}
              </div>
            </section>
            {error && <p class="error">{error}</p>}
            <section class="ligungi-card ligungi-arena__facts">
              <p>{late ? a.waitingStart(view.minPlayers) : a.minPlayers(view.minPlayers, joinedCount)}</p>
              <p class="ligungi-arena__prize">
                <Trophy kind="arenaChampion" size={20} />
                {a.prizes(prizeKey(joinedCount))}
              </p>
            </section>
            <section class="ligungi-card ligungi-arena__joined">
              <h2>{a.playersTitle(joinedCount)}</h2>
              <ul>
                {view.standings.map((s) => (
                  <li key={s.user.id} class={s.user.id === user?.id ? 'is-you' : ''}>
                    <a href={`/@/${s.user.name}`}>{s.user.name}</a>
                    <span class="ligungi-arena__rating">
                      {s.rating}
                      {s.provisional ? '?' : ''}
                    </span>
                    {s.user.id === user?.id && <span class="ligungi-arena__note">{a.you}</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        {!id && <RecentList recent={recent} />}
      </main>
    );
  }

  if (view.status === 'started') {
    const closed = view.endsAt !== null && now >= view.endsAt - ARENA.pairingCutoffMinutes * 60_000;
    const [featured] = view.games;
    const bar = !user || !you?.joined
      ? { text: closed ? a.closedBar : a.notJoinedBar, tone: '', button: user && !closed ? { label: a.join, run: () => void act('join') } : null }
      : you.game
        ? { text: a.playingBar, tone: 'is-playing', link: `/${you.game}` }
        : you.paused
          ? { text: a.pausedBar, tone: 'is-away', button: { label: a.resume, run: () => void act('join') } }
          : { text: closed ? a.closedBar : a.waitingBar, tone: 'is-waiting', button: { label: a.pause, run: () => void act('pause') } };
    return (
      <main class="ligungi-page ligungi-arena">
        <div class="ligungi-arena__layout">
          <div class="ligungi-arena__main">
            {header}
            <section class={`ligungi-arena__bar ${bar.tone}`} role="status">
              <span>{bar.text}</span>
              {'link' in bar && bar.link && (
                <a class="button" href={bar.link}>
                  {a.goToGame}
                </a>
              )}
              {'button' in bar && bar.button && (
                <button type="button" class="button button-empty" disabled={busy} onClick={bar.button.run}>
                  {bar.button.label}
                </button>
              )}
              {!user && <span>{a.loginToJoin}</span>}
            </section>
            {error && <p class="error">{error}</p>}
            <Standings view={view} youId={user?.id ?? null} />
          </div>
          <aside class="ligungi-arena__aside">
            {featured && (
              <a class="ligungi-card ligungi-arena__featured" href={`/${featured.id}`}>
                <h2>{a.featured}</h2>
                <span>{playerName(t, featured.players.black)}</span>
                <MiniBoard fen={featured.fen} />
                <span>{playerName(t, featured.players.white)}</span>
                <span class="text">{a.watch}</span>
              </a>
            )}
            <section class="ligungi-card ligungi-arena__games">
              <h2>{a.ongoing(view.games.length)}</h2>
              {view.games.length === 0 ? (
                <p class="ligungi-arena__note">{a.noGames}</p>
              ) : (
                <ul>
                  {view.games.map((game) => (
                    <li key={game.id}>
                      <a href={`/${game.id}`}>{a.vs(playerName(t, game.players.white), playerName(t, game.players.black))}</a>
                    </li>
                  ))}
                </ul>
              )}
              <p class="ligungi-arena__note">{t.arena.how[3]}</p>
            </section>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main class="ligungi-page ligungi-arena ligungi-arena--over">
      {header}
      {view.status === 'canceled' ? (
        <p class="ligungi-card ligungi-arena__canceled">{a.canceled(view.minPlayers)}</p>
      ) : (
        <>
          {view.standings.length > 0 && <Podium standings={view.standings} />}
          <Standings view={view} youId={user?.id ?? null} />
          <p class="ligungi-arena__note">{view.players >= ARENA.minPlayers ? a.trophyNote(prizeKey(view.players), view.players) : a.noTrophies}</p>
        </>
      )}
      <p>
        <a class="button" href="/arena">
          {a.seeNext}
        </a>
      </p>
      {!id && <RecentList recent={recent} />}
    </main>
  );
};
