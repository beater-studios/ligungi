import { MODES, type Mode } from '@ligungi/engine';
import { TIME_PRESETS, type GameSettings, type GameSummary, type LobbyView, type Me, type SeekView, type TimeControl } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { turns } from '../challenges.ts';
import { CreateGame, type CreateTarget } from '../components/CreateGame.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { Modal } from '../components/Modal.tsx';
import { formatClock, playerName, settingsText, speedText, timeControlText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';
import { useFriends } from './FriendsPage.tsx';

const QUICK_MODE_KEY = 'ligungi.quickMode';
const LIVE_GAMES = 2;

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

/** `undefined` while loading, `'error'` when the request failed. */
type Loaded<T> = T | undefined | 'error';

const Live = ({ games }: { games: Loaded<readonly GameSummary[]> }) => {
  const t = useT();
  return (
    <section class="ligungi-card ligungi-home__live">
      <div class="ligungi-home__card-head">
        <h2>{t.home.liveTitle}</h2>
        <a class="text" data-icon={icons.AnalogTv} href="/tv">
          {t.home.tvLink}
        </a>
      </div>
      {games !== undefined && games !== 'error' && games.length > 0 ? (
        <div class="ligungi-home__live-games">
          {games.map((game) => (
            <a key={game.id} class="ligungi-home__live-game" href={`/${game.id}`}>
              <MiniBoard fen={game.fen} />
              <span class="ligungi-home__live-players">
                {playerName(t, game.players.white)} × {playerName(t, game.players.black)}
              </span>
              <span class="ligungi-home__live-mode">{t.modes[game.mode]}</span>
            </a>
          ))}
        </div>
      ) : (
        <p class="ligungi-notice">{games === undefined ? t.common.loading : games === 'error' ? t.genericError : t.home.noTv}</p>
      )}
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
  const [live, setLive] = useState<Loaded<readonly GameSummary[]>>(undefined);
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
    api
      .get<GameSummary[]>('/api/tv')
      .then((games) => setLive(games.slice(0, LIVE_GAMES)))
      .catch(() => setLive('error'));
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
    run(() => api.post('/api/seeks', { mode, rated, timeControl, color: 'random', firstPlayer: 'random', freeDraft: false }));
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

          {!user && (
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
          )}

          <section class="ligungi-card ligungi-home__learn">
            <h2>{t.home.newTitle}</h2>
            <p>{t.home.intro}</p>
            <a href="/learn">{t.home.learnRules}</a>
          </section>

          <section class="ligungi-card ligungi-home__counters">
            <span>
              <strong class="ligungi-home__online">{lobby?.online ?? 0}</strong> {t.home.online(lobby?.online ?? 0)} ·{' '}
              <strong>{lobby?.playing ?? 0}</strong> {t.home.live}
            </span>
            <a href="/players">{t.home.playersLink}</a>
          </section>

          <OnlineFriends />
          <Live games={live} />
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
