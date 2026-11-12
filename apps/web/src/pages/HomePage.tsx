import { TIME_PRESETS, type GameSummary, type LobbyView, type Me, type SeekView, type TimeControl } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { SOURCE_URL } from '../app.tsx';
import { CreateGame, type CreateTarget } from '../components/CreateGame.tsx';
import { MiniBoard } from '../components/MiniBoard.tsx';
import { icons } from '../icons.ts';
import { PlayerTag } from '../components/PlayerTag.tsx';
import { useFriends } from './FriendsPage.tsx';
import { playerName, timeControlText, useT } from '../i18n/index.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { socket } from '../socket.ts';
import { useStore } from '../store.ts';

type Tab = 'pools' | 'seeks' | 'playing';

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
  const [tv, setTv] = useState<GameSummary | null>(null);
  const [tab, setTab] = useState<Tab>('pools');
  const [create, setCreate] = useState<CreateTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      .get<GameSummary[]>('/api/tv')
      .then((games) => setTv(games[0] ?? null))
      .catch(() => {});
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
      else if (result.seekId) setTab('seeks');
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
            <h2 class="title">{t.home.title}</h2>
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
        {tab === 'pools' && <Pools rated={Boolean(user)} onPool={quick} onCustom={() => setCreate('lobby')} />}
        {tab === 'seeks' && <Seeks seeks={lobby?.seeks ?? []} onAccept={accept} onCancel={cancel} />}
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

      <div class="lobby__tv">
        {tv ? (
          <a class="ligungi-tv" href={`/${tv.id}`}>
            <span class="ligungi-tv__player">
              <PlayerTag player={tv.players.black} />
            </span>
            <MiniBoard fen={tv.fen} />
            <span class="ligungi-tv__player">
              <PlayerTag player={tv.players.white} />
            </span>
          </a>
        ) : (
          <a class="ligungi-tv ligungi-tv--empty" href="/tv">
            {t.home.noTv}
          </a>
        )}
      </div>

      <div class="lobby__about">
        <a href="/learn">{t.home.rules}</a>
        <a href={SOURCE_URL}>{t.home.source}</a>
        <a href="/settings">{t.nav.settings}</a>
      </div>

      {create && <CreateGame target={create} onClose={() => setCreate(null)} />}
    </main>
  );
};
