import type { Mode } from '@ligungi/engine';
import {
  type GameSummary,
  type LobbyView,
  type Me,
  type SeekView,
  type TimeControl,
} from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { turns } from '../game/challenges.ts';
import { CreateGame, type CreateTarget } from '../game/CreateGame.tsx';
import { Modal } from '../components/Modal.tsx';
import { formatClock, playerName, settingsText, speedText, useT } from '../i18n/index.ts';
import { navigate, useLocation } from '../core/router.ts';
import { session } from '../core/session.ts';
import { socket } from '../core/socket.ts';
import { useStore } from '../core/store.ts';
import { FollowFeed, OnlineFriends } from './home/Friends.tsx';
import { Leaders } from './home/Leaders.tsx';
import { Live } from './home/Live.tsx';
import { QUICK_MODE_KEY, QuickGame, SeekRow, storedQuickMode } from './home/QuickGame.tsx';
import { DailyPuzzleCard, Training } from './home/Training.tsx';

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
              <FollowFeed />
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
