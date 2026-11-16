import { MODES, type Mode } from '@ligungi/engine';
import {
  LESSON_STAGES,
  TIME_PRESETS,
  type DailyPuzzle,
  type GameSettings,
  type GameSummary,
  type Leaderboard,
  type LobbyView,
  type Me,
  type PuzzleRatingView,
  type SeekView,
  type TimeControl,
} from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { turns } from '../challenges.ts';
import { CreateGame, type CreateTarget } from '../components/CreateGame.tsx';
import { LivePlayer } from '../components/LivePlayer.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { Modal } from '../components/Modal.tsx';
import { formatClock, playerName, settingsText, speedText, timeControlText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { useLessonProgress } from '../lessonProgress.ts';
import { useLiveGames } from '../liveGames.ts';
import { usePuzzleRuns } from '../puzzleRuns.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';
import { useFriends } from './FriendsPage.tsx';

const QUICK_MODE_KEY = 'ligungi.quickMode';
/** Leaders shown per mode in the home's leaders card. */
const LEADERS_PER_MODE = 2;

/** The mode last picked for quick pairing; storage may be missing (prerender) or blocked. */
const storedQuickMode = (): Mode => {
  try {
    const stored = localStorage.getItem(QUICK_MODE_KEY);
    return MODES.find((mode) => mode === stored) ?? 'advanced';
  } catch {
    return 'advanced';
  }
};

const sameTimeControl = (a: TimeControl | null, b: TimeControl | null): boolean =>
  a === b || (a !== null && b !== null && a.initial === b.initial && a.increment === b.increment);

/** Open seeks that a quick pairing seek with these settings would be paired with, as the server pairs them. */
const waitingFor = (seeks: readonly SeekView[], settings: Pick<GameSettings, 'mode' | 'rated' | 'timeControl'>): number =>
  seeks.filter(
    (seek) =>
      !seek.mine &&
      seek.settings.mode === settings.mode &&
      seek.settings.rated === settings.rated &&
      !seek.settings.freeDraft &&
      sameTimeControl(seek.settings.timeControl, settings.timeControl),
  ).length;

/** Shown in place of the quick pairing grid while the player's own games wait in the lobby. */
const Waiting = ({ seeks, onCancel }: { seeks: readonly SeekView[]; onCancel: (seek: SeekView) => void }) => {
  const t = useT();
  return (
    <div class="ligungi-waiting" role="status">
      <div class="ligungi-waiting__spinner" aria-hidden="true" />
      <h2>{t.home.waitingTitle}</h2>
      {seeks.map((seek) => (
        <div key={seek.id} class="ligungi-waiting__seek">
          <span>{settingsText(t, seek.settings)}</span>
          <button type="button" class="button button-empty button-red" onClick={() => onCancel(seek)}>
            {t.home.cancelSeek}
          </button>
        </div>
      ))}
      <p class="ligungi-waiting__hint">{t.home.waitingHint}</p>
    </div>
  );
};

const QuickGame = ({
  mode,
  rated,
  lobby,
  mine,
  onMode,
  onPool,
  onCancel,
}: {
  mode: Mode;
  rated: boolean;
  lobby: LobbyView | null;
  mine: readonly SeekView[];
  onMode: (mode: Mode) => void;
  onPool: (timeControl: TimeControl) => void;
  onCancel: (seek: SeekView) => void;
}) => {
  const t = useT();
  return (
    <section class="ligungi-card ligungi-home__quick">
      <div class="ligungi-home__quick-head">
        <h1>{t.home.quickGame}</h1>
        <div class="ligungi-segmented ligungi-home__modes" role="group" aria-label={t.common.mode}>
          {MODES.map((m) => (
            <button key={m} type="button" class={m === mode ? 'active' : ''} aria-pressed={m === mode} onClick={() => onMode(m)}>
              {t.modes[m]}
            </button>
          ))}
        </div>
      </div>
      {mine.length > 0 ? (
        <Waiting seeks={mine} onCancel={onCancel} />
      ) : (
        <>
          <div class="ligungi-pools">
            {TIME_PRESETS.map((timeControl) => {
              const waiting = waitingFor(lobby?.seeks ?? [], { mode, rated, timeControl });
              return (
                <button key={timeControlText(t, timeControl)} type="button" class="ligungi-pool" onClick={() => onPool(timeControl)}>
                  <span class="ligungi-pool__clock">{timeControlText(t, timeControl)}</span>
                  <span class="ligungi-pool__kind">{rated ? t.rated : t.casual}</span>
                  <span class={`ligungi-pool__waiting${waiting > 0 ? ' is-waiting' : ''}`}>{t.home.waiting(waiting)}</span>
                </button>
              );
            })}
          </div>
          <p class="ligungi-home__hint">{t.home.quickHint}</p>
        </>
      )}
    </section>
  );
};

const SeekRow = ({ seek, onAccept, onCancel }: { seek: SeekView; onAccept: (s: SeekView) => void; onCancel: (s: SeekView) => void }) => {
  const t = useT();
  const { settings } = seek;
  const mode = `${t.modes[settings.mode]}${settings.freeDraft ? ` (${t.freeDraftTag})` : ''}`;
  const kind = settings.rated ? t.rated : t.casual;
  return (
    <li class={`ligungi-seek${seek.mine ? ' ligungi-seek--mine' : ''}`}>
      <span class="ligungi-seek__player">
        <span class={`is is2 color-icon ${settings.color}`} title={t.colorChoices[settings.color]} />
        <span class="ligungi-seek__name">{playerName(t, seek.player)}</span>
        {seek.player.rating !== null && <span class="ligungi-seek__rating">{seek.player.rating}</span>}
      </span>
      <span class="ligungi-seek__time">{settings.daysPerMove ? t.days(settings.daysPerMove) : speedText(t, settings)}</span>
      <span class="ligungi-seek__mode">{mode}</span>
      <span class="ligungi-seek__kind">{kind}</span>
      {/* Phones: the settings on one line under the name. */}
      <span class="ligungi-seek__meta">{[mode, speedText(t, settings), kind].join(' · ')}</span>
      {seek.mine ? (
        <button type="button" class="button button-empty button-red ligungi-seek__action" onClick={() => onCancel(seek)}>
          {t.home.cancel}
        </button>
      ) : (
        <button type="button" class="button ligungi-button-good ligungi-seek__action" onClick={() => onAccept(seek)}>
          {t.home.join}
        </button>
      )}
    </li>
  );
};

/** The strongest live game, following every move with its clocks, as on the TV, and how many are online and playing. */
const Live = ({ lobby }: { lobby: LobbyView | null }) => {
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

/** The best players of each mode, from the leaderboard; it invites rated play while nobody is on it. */
const Leaders = () => {
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
              <strong>{entry.rating}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** For a signed-in player: their puzzle rating, Storm and Streak records and how far the lessons go, each a link. */
const Training = ({ puzzleRating }: { puzzleRating: PuzzleRatingView | null }) => {
  const t = useT();
  const runs = usePuzzleRuns().view;
  const { progress } = useLessonProgress();
  const stagesDone = progress ? LESSON_STAGES.filter((stage) => stage.exercises.every((exercise) => (progress[exercise.id] ?? 0) > 0)).length : null;
  const rows: Array<{ href: string; label: string; value: string | null }> = [
    { href: '/puzzles/dashboard', label: t.home.puzzleRating, value: puzzleRating ? `${puzzleRating.rating}${puzzleRating.provisional ? '?' : ''}` : null },
    { href: '/storm', label: t.home.stormBest, value: runs ? String(runs.best.storm) : null },
    { href: '/streak', label: t.home.streakBest, value: runs ? String(runs.best.streak) : null },
    { href: '/lessons', label: t.home.lessons, value: stagesDone === null ? null : t.home.lessonsDone(stagesDone, LESSON_STAGES.length) },
  ];
  return (
    <section class="ligungi-card ligungi-home__training">
      <h2>{t.home.trainTitle}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.href}>
            <a href={row.href}>
              <span>{row.label}</span>
              <strong>{row.value ?? '-'}</strong>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** The puzzle of the day, the same for everyone: a small board and a link to solve it. */
const DailyPuzzleCard = () => {
  const t = useT();
  const [daily, setDaily] = useState<DailyPuzzle | null>(null);
  useEffect(() => {
    api.get<DailyPuzzle>('/api/puzzles/daily').then(setDaily).catch(() => {});
  }, []);
  if (!daily) return null;
  const task = daily.kind === 'mate' ? t.puzzles.taskMate(t.colors[daily.color], daily.moves) : t.puzzles.taskMaterial(t.colors[daily.color]);
  return (
    <section class="ligungi-card ligungi-home__daily">
      <div class="ligungi-home__card-head">
        <h2>{t.home.dailyPuzzle}</h2>
        <a href="/puzzles">{t.nav.puzzles}</a>
      </div>
      <a class="ligungi-home__daily-board" href="/puzzles/daily" aria-label={`${t.home.dailyPuzzle}: ${task}`}>
        <MiniBoard fen={daily.fen} orientation={daily.color} />
      </a>
      <p>{task}</p>
      <a class="button ligungi-home__solve" href="/puzzles/daily">
        {t.home.solveDaily}
      </a>
      <p class="ligungi-home__daily-links">
        <a href="/streak">{t.puzzleRuns.streak}</a>
        <a href="/storm">{t.puzzleRuns.storm}</a>
      </p>
    </section>
  );
};

const OnlineFriends = () => {
  const t = useT();
  const friends = useFriends();
  const online = friends?.filter((friend) => friend.online) ?? [];
  if (online.length === 0) return null;
  return (
    <section class="ligungi-card ligungi-home__friends">
      <div class="ligungi-home__card-head">
        <h2>{t.friends.onlineBox}</h2>
        <a href="/friends">{online.length}</a>
      </div>
      <ul>
        {online.map((friend) => (
          <li key={friend.user.id}>
            <a class="user-link online" href={`/@/${friend.user.name}`}>
              <i class="line" />
              {friend.user.name}
            </a>
            {friend.playing && <a class="ligungi-home__friend-watch" href={`/${friend.playing}`} title={t.friends.watch} data-icon={icons.Eye} />}
          </li>
        ))}
      </ul>
    </section>
  );
};

export const HomePage = () => {
  const t = useT();
  const { user } = useStore(session);
  const { search } = useLocation();
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [mode, setMode] = useState<Mode>(storedQuickMode);
  const [create, setCreate] = useState<CreateTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<SeekView | null>(null);
  const [tab, setTab] = useState<'live' | 'correspondence'>('live');
  const correspondence = lobby?.seeks.filter((seek) => seek.settings.daysPerMove) ?? [];
  const liveSeeks = lobby?.seeks.filter((seek) => !seek.settings.daysPerMove) ?? [];
  // Correspondence seeks wait for days, so they never hold the quick pairing grid.
  const mine = liveSeeks.filter((seek) => seek.mine);
  const rated = Boolean(user);

  useEffect(() => {
    const target = new URLSearchParams(search).get('create');
    if (target === 'lobby' || target === 'friend') {
      setCreate(target);
      navigate('/', true);
    }
  }, [search]);

  useEffect(() => {
    const unsubscribe = socket.subscribe('lobby');
    const off = socket.on((message) => {
      if (message.t === 'lobby') setLobby(message.lobby);
    });
    api.get<LobbyView>('/api/lobby').then(setLobby).catch(() => {});
    return () => {
      unsubscribe();
      off();
    };
  }, [user?.id]);

  // Reloaded when a correspondence move arrives, so the strips below say whose turn it is.
  const waiting = useStore(turns);
  useEffect(() => {
    api.get<Me>('/api/me').then(setMe).catch(() => {});
  }, [user?.id, waiting]);

  // A correspondence game just created waits in its own tab, so show that tab.
  const myCorrespondence = correspondence.filter((seek) => seek.mine).length;
  const lastMyCorrespondence = useRef<number | null>(null);
  useEffect(() => {
    if (lobby === null) return;
    if (lastMyCorrespondence.current !== null && myCorrespondence > lastMyCorrespondence.current) setTab('correspondence');
    lastMyCorrespondence.current = myCorrespondence;
  }, [lobby, myCorrespondence]);

  const pickMode = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(QUICK_MODE_KEY, next);
    } catch {
      // Remembering the mode is a convenience; without storage the default comes back next time.
    }
  };

  const run = async (task: () => Promise<{ gameId?: string; seekId?: string }>) => {
    setError(null);
    try {
      const result = await task();
      if (result.gameId) navigate(`/${result.gameId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const quick = (timeControl: TimeControl) =>
    run(() => api.post('/api/seeks', { mode, rated, timeControl, color: 'random', freeDraft: false }));
  const accept = (seek: SeekView) => run(() => api.post(`/api/seeks/${seek.id}/accept`));
  const cancel = (seek: SeekView) => run(() => api.delete(`/api/seeks/${seek.id}`));
  const seeks = tab === 'live' ? liveSeeks : correspondence;
  // The viewer's side, known only with an account (an anonymous game has no user to match).
  const isMyTurn = (game: GameSummary) => game.turn !== null && user !== null && game.players[game.turn].user?.id === user.id;
  const ongoing = [...(me?.playing ?? [])].sort((a, b) => Number(isMyTurn(b)) - Number(isMyTurn(a)));

  return (
    <main class="ligungi-page ligungi-home">
      {ongoing.map((game) => (
        <section key={game.id} class={`ligungi-card ligungi-live-strip${isMyTurn(game) ? ' is-my-turn' : ''}`}>
          <span class="ligungi-live-badge">{isMyTurn(game) ? t.nav.yourTurn : t.home.yourGame}</span>
          <span class="ligungi-live-strip__text">
            {playerName(t, game.players.white)} × {playerName(t, game.players.black)} · {t.modes[game.mode]} · {speedText(t, game)}
            {game.daysPerMove !== null && game.deadlineIn !== null && (
              <small class="ligungi-live-strip__deadline">
                {isMyTurn(game) ? t.nav.timeLeft(formatClock(game.deadlineIn)) : t.home.theirTurn}
              </small>
            )}
          </span>
          <a class="button" href={`/${game.id}`}>
            {t.home.resume}
          </a>
        </section>
      ))}

      <div class="ligungi-home__layout">
        <div class="ligungi-home__aside">
          <DailyPuzzleCard />
          <Live lobby={lobby} />
        </div>

        <div class="ligungi-home__main">
          <QuickGame mode={mode} rated={rated} lobby={lobby} mine={mine} onMode={pickMode} onPool={quick} onCancel={setCancelling} />
          {error && <p class="error ligungi-home__error">{error}</p>}
          <section class="ligungi-card ligungi-home__open">
            <div class="ligungi-home__card-head">
              <div>
                <h2>{t.home.openTitle}</h2>
                <span class="ligungi-home__card-note">{t.home.openHint}</span>
              </div>
              <div class="ligungi-segmented ligungi-home__open-tabs" role="group" aria-label={t.create.speed}>
                {(
                  [
                    ['live', t.create.speedLive, liveSeeks.length],
                    ['correspondence', t.create.speedCorrespondence, correspondence.length],
                  ] as const
                ).map(([value, label, count]) => (
                  <button key={value} type="button" class={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>
                    {label} <span class="ligungi-home__open-count">{count}</span>
                  </button>
                ))}
              </div>
            </div>
            {seeks.length === 0 ? (
              <p class="ligungi-notice">{tab === 'live' ? t.home.noSeeks : t.home.noCorrespondenceSeeks}</p>
            ) : (
              <ul class="ligungi-seeks">
                {seeks.map((seek) => (
                  <SeekRow key={seek.id} seek={seek} onAccept={accept} onCancel={setCancelling} />
                ))}
              </ul>
            )}
          </section>
          <Leaders />
        </div>

        <div class="ligungi-home__side">
          <div class="ligungi-home__actions">
            <button type="button" class="button ligungi-button-good" onClick={() => setCreate('lobby')}>
              {t.nav.createGame}
            </button>
            <button type="button" class="button button-empty" onClick={() => setCreate('friend')}>
              {t.nav.playFriend}
            </button>
            <a class="button button-empty" href="/computer">
              {t.nav.playComputer}
            </a>
          </div>

          {user ? (
            <>
              <OnlineFriends />
              <Training puzzleRating={me?.puzzleRating ?? null} />
            </>
          ) : (
            <>
              <section class="ligungi-card ligungi-home__account">
                <p>{t.home.accountPitch}</p>
                <div class="ligungi-home__account-actions">
                  <a href="/signup" class="button">
                    {t.nav.signUp}
                  </a>
                  <a href="/login" class="button button-empty">
                    {t.nav.signIn}
                  </a>
                </div>
              </section>
              <section class="ligungi-card ligungi-home__learn">
                <h2>{t.home.newTitle}</h2>
                <p>{t.home.intro}</p>
                <div class="ligungi-home__learn-links">
                  <a href="/lessons">{t.home.lessons}</a>
                  <a href="/learn">{t.home.learnRules}</a>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {create && <CreateGame target={create} onClose={() => setCreate(null)} />}
      {cancelling && (
        <Modal title={t.home.cancelTitle} onClose={() => setCancelling(null)}>
          <p>{t.home.cancelText}</p>
          <p class="ligungi-modal__summary">{settingsText(t, cancelling.settings)}</p>
          <div class="ligungi-modal__actions">
            <button type="button" class="button button-empty" onClick={() => setCancelling(null)}>
              {t.home.keepWaiting}
            </button>
            <button
              type="button"
              class="button button-red"
              onClick={() => {
                void cancel(cancelling);
                setCancelling(null);
              }}
            >
              {t.home.confirmCancel}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
};
