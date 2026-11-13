import { TIME_PRESETS, type GameSummary, type LeaderEntry, type LobbyView, type Me, type SeekView, type TimeControl } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { CreateGame, type CreateTarget } from '../components/CreateGame.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { icons } from '../icons.ts';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { useFriends } from './FriendsPage.tsx';
import { playerName, settingsText, timeControlText, useT } from '../i18n/index.ts';
import { Modal } from '../components/Modal.tsx';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';

type Tab = 'pools' | 'seeks' | 'playing';

/** Shown in place of the quick pairing grid while the player's own games wait in the lobby. */
const Waiting = ({ seeks, onCancel }: { seeks: readonly SeekView[]; onCancel: (seek: SeekView) => void }) => {
  const t = useT();
  return (
    <div class="lobby__app__content ligungi-waiting" role="status">
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

const Pools = ({ rated, onPool, onCustom }: { rated: boolean; onPool: (tc: TimeControl) => void; onCustom: () => void }) => {
  const t = useT();
  return (
  <div class="lobby__app__content lpools">
    {TIME_PRESETS.map((tc) => (
      <div
        key={timeControlText(t, tc)}
        class="lpool"
        role="button"
        tabIndex={0}
        onClick={() => onPool(tc)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPool(tc))}
      >
        <div class="clock">{timeControlText(t, tc)}</div>
        <div class="perf">{rated ? t.rated : t.casual}</div>
      </div>
    ))}
    <div class="lpool" role="button" tabIndex={0} onClick={onCustom} onKeyDown={(e) => e.key === 'Enter' && onCustom()}>
      {t.home.custom}
    </div>
  </div>
  );
};

const Seeks = ({ seeks, onAccept, onCancel }: { seeks: readonly SeekView[]; onAccept: (s: SeekView) => void; onCancel: (s: SeekView) => void }) => {
  const t = useT();
  return (
  <div class="lobby__app__content lreal_time">
    <table class="hooks__list">
      <thead>
        <tr>
          <th />
          <th class="player">{t.home.player}</th>
          <th>{t.home.rating}</th>
          <th>{t.home.time}</th>
          <th>{t.common.mode}</th>
        </tr>
      </thead>
      <tbody>
        {seeks.length === 0 && (
          <tr class="variants">
            <td colSpan={5}>{t.home.noSeeks}</td>
          </tr>
        )}
        {seeks.map((seek) => (
          <tr
            key={seek.id}
            class={seek.mine ? 'cancel' : 'join'}
            title={seek.mine ? t.home.cancel : t.home.join}
            onClick={() => (seek.mine ? onCancel(seek) : onAccept(seek))}
          >
            <td>
              <span class={`is is2 color-icon ${seek.settings.color}`} />
            </td>
            <td>{playerName(t, seek.player)}</td>
            <td>{seek.player.rating ?? ''}</td>
            <td>{timeControlText(t, seek.settings.timeControl)}</td>
            <td>
              {t.modes[seek.settings.mode]}
              {seek.settings.freeDraft ? ` (${t.freeDraftTag})` : ''} · {seek.settings.rated ? t.rated : t.casual}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

const OnlineFriends = () => {
  const t = useT();
  const friends = useFriends();
  if (!friends) return null;
  const online = friends.filter((friend) => friend.online);
  return (
    <div class="lobby__box ligungi-friend-box">
      <div class="lobby__box__top">
        <h2 class="title">
          <a href="/friends">{t.friends.onlineBox}</a>
        </h2>
        <span class="more">{online.length}</span>
      </div>
      <div class="lobby__box__content">
        {online.length === 0 ? (
          <p class="ligungi-notice">{t.friends.noneOnline}</p>
        ) : (
          <ul>
            {online.map((friend) => (
              <li key={friend.user.id}>
                <a class="user-link online" href={`/@/${friend.user.name}`}>
                  <i class="line" />
                  {friend.user.name}
                </a>
                {friend.playing && (
                  <a class="ligungi-friend-box__watch" href={`/${friend.playing}`} title={t.friends.watch} data-icon={icons.Eye} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const LEADERBOARD_MODE = 'advanced';
const HOME_LEADERBOARD_SIZE = 8;

/** `undefined` while loading, `'error'` when the request failed. */
type Loaded<T> = T | undefined | 'error';

const LeaderboardBox = ({ entries }: { entries: Loaded<readonly LeaderEntry[]> }) => {
  const t = useT();
  return (
    <div class="lobby__box ligungi-home-leaders">
      <div class="lobby__box__top">
        <h2 class="title text" data-icon={icons.Trophy}>
          {t.ranking.title} · {t.modes[LEADERBOARD_MODE]}
        </h2>
        <a class="more" href={`/ranking/${LEADERBOARD_MODE}`}>
          {t.home.more}
        </a>
      </div>
      <div class="lobby__box__content">
        {Array.isArray(entries) && entries.length > 0 ? (
          <table>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.user.id}>
                  <td class="ligungi-home-leaders__rank">{index + 1}</td>
                  <td>
                    <a class={`user-link ${entry.online ? 'online' : 'offline'}`} href={`/@/${entry.user.name}`}>
                      <i class="line" />
                      {entry.user.name}
                    </a>
                  </td>
                  <td class="ligungi-home-leaders__rating">{entry.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p class="ligungi-notice ligungi-box-empty">
            {entries === undefined ? t.common.loading : entries === 'error' ? t.genericError : t.ranking.empty}
          </p>
        )}
      </div>
    </div>
  );
};

const TvBox = ({ game }: { game: Loaded<GameSummary | null> }) => {
  const t = useT();
  return (
    <div class="lobby__tv lobby__box ligungi-home-tv">
      <div class="lobby__box__top">
        <h2 class="title text" data-icon={icons.AnalogTv}>
          {t.home.featured}
        </h2>
        <a class="more" href="/tv">
          {t.home.more}
        </a>
      </div>
      <div class="lobby__box__content">
        {game && game !== 'error' ? (
          <a class="ligungi-tv" href={`/${game.id}`}>
            <span class="ligungi-tv__player">
              <PlayerTag player={game.players.black} />
            </span>
            <MiniBoard fen={game.fen} />
            <span class="ligungi-tv__player">
              <PlayerTag player={game.players.white} />
            </span>
          </a>
        ) : (
          <p class="ligungi-notice ligungi-box-empty">
            {game === undefined ? t.common.loading : game === 'error' ? t.genericError : t.home.noTv}
          </p>
        )}
      </div>
    </div>
  );
};

const Playing = ({ games }: { games: readonly GameSummary[] }) => {
  const t = useT();
  return (
  <div class="lobby__app__content lnow_playing">
    {games.length === 0 ? (
      <p class="lobby__app__empty">{t.home.noPlaying}</p>
    ) : (
      <div class="now-playing">
        {games.map((game) => (
          <a key={game.id} href={`/${game.id}`}>
            <MiniBoard fen={game.fen} />
            <span class="meta">
              {playerName(t, game.players.white)} × {playerName(t, game.players.black)}
            </span>
          </a>
        ))}
      </div>
    )}
  </div>
  );
};

export const HomePage = () => {
  const t = useT();
  const { user } = useStore(session);
  const { search } = useLocation();
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tv, setTv] = useState<Loaded<GameSummary | null>>(undefined);
  const [leaders, setLeaders] = useState<Loaded<readonly LeaderEntry[]>>(undefined);
  const [tab, setTab] = useState<Tab>('pools');
  const [create, setCreate] = useState<CreateTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<SeekView | null>(null);
  const mine = lobby?.seeks.filter((seek) => seek.mine) ?? [];

  // A new game of ours in the lobby (from quick pairing or the create dialog) brings the waiting panel into view.
  useEffect(() => {
    if (mine.length > 0) setTab('pools');
  }, [mine.length > 0]);

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
    api.get<Me>('/api/me').then(setMe).catch(() => {});
    api
      .get<LeaderEntry[]>(`/api/leaderboard/${LEADERBOARD_MODE}?limit=${HOME_LEADERBOARD_SIZE}`)
      .then(setLeaders)
      .catch(() => setLeaders('error'));
    api
      .get<GameSummary[]>('/api/tv')
      .then((games) => setTv(games[0] ?? null))
      .catch(() => setTv('error'));
    return () => {
      unsubscribe();
      off();
    };
  }, [user?.id]);

  const run = async (task: () => Promise<{ gameId?: string; seekId?: string }>) => {
    setError(null);
    try {
      const result = await task();
      if (result.gameId) navigate(`/${result.gameId}`);
      else if (result.seekId) setTab('pools');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const quick = (timeControl: TimeControl) =>
    run(() =>
      api.post('/api/seeks', {
        mode: 'advanced',
        rated: Boolean(user),
        timeControl,
        color: 'random',
        firstPlayer: 'random',
        freeDraft: false,
      }),
    );
  const accept = (seek: SeekView) => run(() => api.post(`/api/seeks/${seek.id}/accept`));
  const cancel = (seek: SeekView) => run(() => api.delete(`/api/seeks/${seek.id}`));
  const playing = me?.playing ?? [];

  const tabButton = (key: Tab, label: string, count?: number) => (
    <span role="tab" class={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
      {label}
      {count ? ` ${count}` : ''}
    </span>
  );

  return (
    <main class="lobby">
      <div class="lobby__side">
        <div class="lobby__box">
          <div class="lobby__box__top">
            <h1 class="title">{t.home.title}</h1>
          </div>
          <div class="lobby__box__content ligungi-intro">
            <p>{t.home.intro}</p>
            <p>
              <a href="/learn">{t.home.learnRules}</a>
            </p>
            {!user && (
              <div class="ligungi-account-pitch">
                <p>{t.home.accountPitch}</p>
                <div class="ligungi-account-pitch__actions">
                  <a href="/signup" class="button">
                    {t.nav.signUp}
                  </a>
                  <a href="/login" class="button button-empty">
                    {t.nav.signIn}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        <OnlineFriends />
      </div>

      <div class={`lobby__app lobby__app-${tab}`}>
        <div class="tabs-horiz" role="tablist">
          {tabButton('pools', t.home.quickGame)}
          {tabButton('seeks', t.home.lobby, lobby?.seeks.length)}
          {tabButton('playing', t.home.playing, playing.length)}
        </div>
        {tab === 'pools' &&
          (mine.length > 0 ? (
            <Waiting seeks={mine} onCancel={setCancelling} />
          ) : (
            <Pools rated={Boolean(user)} onPool={quick} onCustom={() => setCreate('lobby')} />
          ))}
        {tab === 'seeks' && <Seeks seeks={lobby?.seeks ?? []} onAccept={accept} onCancel={setCancelling} />}
        {tab === 'playing' && <Playing games={playing} />}
      </div>

      <div class="lobby__table">
        <div class="lobby__start">
          <button type="button" class="button button-metal lobby__start__button lobby__start__button--hook" onClick={() => setCreate('lobby')}>
            {t.nav.createGame}
          </button>
          <button type="button" class="button button-metal lobby__start__button lobby__start__button--friend" onClick={() => setCreate('friend')}>
            {t.nav.playFriend}
          </button>
          <button type="button" class="button button-metal lobby__start__button lobby__start__button--ai" onClick={() => navigate('/computer')}>
            {t.nav.playComputer}
          </button>
        </div>
        {error && <p class="error ligungi-error">{error}</p>}
        <div class="lobby__counters">
          <a href="/tv">
            <strong>{lobby?.online ?? 0}</strong> {t.home.playersOnline(lobby?.online ?? 0)}
          </a>
          <a href="/tv">
            <strong>{lobby?.playing ?? 0}</strong> {t.home.gamesPlaying(lobby?.playing ?? 0)}
          </a>
        </div>
      </div>

      <TvBox game={tv} />
      <LeaderboardBox entries={leaders} />


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
