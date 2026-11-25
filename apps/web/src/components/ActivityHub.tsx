import { MODES, opposite, type Mode } from '@ligungi/engine';
import { ACTIVITY_TIME_CONTROLS, type ActivityHallView, type ActivityRoomView, type ColorChoice, type GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import {
  activity,
  activityTab,
  callPeople,
  callRooms,
  closeRoom,
  inActivity,
  inviteToCall,
  joinRoom,
  openRoom,
  setActivityTab,
  type ActivityState,
  type CallPerson,
  type RoomSettings,
} from '../discordActivity.ts';
import { colorChoiceOptions, playerName, speedText, useT } from '../i18n/index.ts';
import { navigate, useLocation } from '../router.ts';
import { SITE_URL, SOURCE_URL } from '../source.ts';
import { useStore } from '../store.ts';
import { OptionCards, SubmitButton } from './ui.tsx';

/** How often the hub asks for the call's rooms, while the page is visible. */
const ROOMS_POLL_MS = 4000;

const timeLabel = (index: number): string => {
  const tc = ACTIVITY_TIME_CONTROLS[index]!;
  return `${tc.initial / 60}+${tc.increment}`;
};

/** The header switch inside Discord: the call's rooms, or the site's own pages. */
export const ActivitySwitch = () => {
  const t = useT();
  const a = t.discordActivity;
  const tab = useStore(activityTab);
  const { path } = useLocation();
  const onCall = path === '/' && tab === 'call';
  const go = (next: 'call' | 'site') => {
    setActivityTab(next);
    if (path !== '/') navigate('/');
  };
  return (
    <div class="ligungi-segmented ligungi-hub-switch" role="group" aria-label={a.tabs}>
      <button type="button" class={onCall ? 'active' : ''} aria-pressed={onCall} onClick={() => go('call')}>
        {a.tabCall}
      </button>
      <button type="button" class={onCall ? '' : 'active'} aria-pressed={!onCall} onClick={() => go('site')}>
        {a.tabSite}
      </button>
    </div>
  );
};

/** Marks the page while it shows the call's rooms, so the site's menu steps aside. */
export const useActivityChrome = (path: string): void => {
  const tab = useStore(activityTab);
  const onCall = inActivity && path === '/' && tab === 'call';
  useEffect(() => {
    document.body.classList.toggle('ligungi-discord--call', onCall);
  }, [onCall]);
};

/** The footer inside Discord: one line, since the page lasts only as long as the call. */
export const ActivityFooter = () => {
  const t = useT();
  return (
    <nav class="ligungi-hub-footer" aria-label={t.footer.siteTitle}>
      <a href="/terms">{t.nav.terms}</a>
      <a href="/privacy">{t.nav.privacy}</a>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
        {t.footer.sourceCode}
      </a>
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
        {t.discordActivity.openSite(new URL(SITE_URL).host)}
      </a>
    </nav>
  );
};

const Face = ({ person }: { person: CallPerson }) => {
  const [broken, setBroken] = useState(false);
  return person.avatar && !broken ? (
    <img class="ligungi-hub__face" src={person.avatar} alt={person.name} title={person.name} width="36" height="36" onError={() => setBroken(true)} />
  ) : (
    <span class="ligungi-hub__face" role="img" aria-label={person.name} title={person.name}>
      {person.name.slice(0, 1).toUpperCase()}
    </span>
  );
};

const Initial = ({ name }: { name: string }) => (
  <span class="ligungi-avatar ligungi-avatar--small" aria-hidden="true">
    {name.slice(0, 1).toUpperCase()}
  </span>
);

interface ActivityHubViewProps {
  readonly state: ActivityState;
  /** The call's rooms and games; `null` until first known. */
  readonly hall: ActivityHallView | null;
  readonly people: readonly CallPerson[];
  readonly onOpen: (settings: RoomSettings) => Promise<void>;
  readonly onJoin: (challengeId: string) => Promise<void>;
  readonly onClose: (challengeId: string) => Promise<void>;
  readonly onInvite: () => void;
}

/** The home page inside Discord: who is in the call, a form to open a room, and the call's rooms and games. */
export const ActivityHubView = ({ state, hall, people, onOpen, onJoin, onClose, onInvite }: ActivityHubViewProps) => {
  const t = useT();
  const a = t.discordActivity;
  const [mode, setMode] = useState<Mode>('beginner');
  const [time, setTime] = useState(2);
  const [color, setColor] = useState<ColorChoice>('random');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state.status === 'off') return null;
  if (state.status !== 'ready') {
    return (
      <main class="ligungi-page ligungi-hub">
        <section class="ligungi-card ligungi-hub__card">
          {state.status === 'starting' ? (
            <p class="ligungi-notice" role="status">
              {a.connecting}
            </p>
          ) : (
            <p class="error" role="alert">
              {a.failed}
            </p>
          )}
        </section>
      </main>
    );
  }

  const roomColor = (room: ActivityRoomView): ColorChoice =>
    room.mine || room.settings.color === 'random' ? room.settings.color : opposite(room.settings.color);
  const room = (r: ActivityRoomView) => {
    const name = playerName(t, r.challenger);
    return (
      <li key={r.challengeId} class={`ligungi-hub__row${r.mine ? ' is-mine' : ''}`}>
        <Initial name={name} />
        <div class="ligungi-hub__who">
          <b>{r.mine ? a.yours : name}</b>
          <small>
            {[r.mine || r.challenger.rating === null ? null : String(r.challenger.rating), t.modes[r.settings.mode], speedText(t, r.settings), a.youPlay(roomColor(r))]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </div>
        {r.mine ? (
          <button type="button" class="button button-empty" disabled={busy} onClick={() => run(() => onClose(r.challengeId))}>
            {a.cancel}
          </button>
        ) : (
          <button type="button" class="button ligungi-button-good" disabled={busy} onClick={() => run(() => onJoin(r.challengeId))}>
            {a.join}
          </button>
        )}
      </li>
    );
  };
  const game = (g: GameSummary) => {
    const white = playerName(t, g.players.white);
    const black = playerName(t, g.players.black);
    return (
      <li key={g.id} class="ligungi-hub__row">
        <span class="ligungi-hub__pair" aria-hidden="true">
          <Initial name={white} />
          <Initial name={black} />
        </span>
        <div class="ligungi-hub__who">
          <b>
            {white} × {black}
          </b>
          <small>{[t.modes[g.mode], speedText(t, g), a.moves(g.plies)].join(' · ')}</small>
        </div>
        <a class="button button-empty" href={`/${g.id}`}>
          {a.watch}
        </a>
      </li>
    );
  };

  const rooms = hall?.rooms ?? [];
  const games = hall?.games ?? [];
  return (
    <main class="ligungi-page ligungi-hub">
      <section class="ligungi-card ligungi-hub__call">
        <h2>{a.inCall}</h2>
        <div class="ligungi-hub__people">
          {people.map((person) => (
            <Face key={person.id} person={person} />
          ))}
        </div>
        <button type="button" class="button button-empty" onClick={onInvite}>
          {a.invite}
        </button>
      </section>
      <div class="ligungi-hub__cols">
        <section class="ligungi-card ligungi-hub__card">
          <h2>{a.createTitle}</h2>
          <p class="ligungi-hub__hint">{a.createHint}</p>
          <form
            class="ligungi-hub__form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => onOpen({ mode, timeControl: ACTIVITY_TIME_CONTROLS[time]!, color }));
            }}
          >
            <OptionCards
              name="hub-mode"
              legend={t.common.mode}
              layout="segmented"
              value={mode}
              options={MODES.map((m) => ({ value: m, label: t.modes[m] }))}
              onChange={setMode}
            />
            <OptionCards
              name="hub-time"
              legend={t.challenge.time}
              layout="segmented"
              value={time}
              options={ACTIVITY_TIME_CONTROLS.map((_, i) => ({ value: i, label: timeLabel(i) }))}
              onChange={setTime}
            />
            <OptionCards
              name="hub-color"
              legend={t.common.yourColor}
              layout="segmented"
              value={color}
              options={colorChoiceOptions(t).map((option) => ({
                ...option,
                icon: <span class={`ligungi-choice__disc ligungi-choice__disc--${option.value}`} aria-hidden="true" />,
              }))}
              onChange={setColor}
            />
            {state.reason && (
              <p class="ligungi-notice">
                {a.guest[state.reason]}{' '}
                {state.reason === 'unlinked' && (
                  <a href="/account" target="_blank" rel="noopener">
                    {a.linkAccount}
                  </a>
                )}
              </p>
            )}
            <SubmitButton disabled={busy}>{a.create}</SubmitButton>
          </form>
        </section>
        <section class="ligungi-card ligungi-hub__card" aria-live="polite">
          <h2>{a.roomsTitle}</h2>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {rooms.length === 0 && games.length === 0 && <p class="ligungi-hub__empty">{a.noRooms}</p>}
          {rooms.length > 0 && (
            <>
              <h3 class="ligungi-hub__group">{a.waitingGroup}</h3>
              <ul class="ligungi-hub__list">{rooms.map(room)}</ul>
            </>
          )}
          {games.length > 0 && (
            <>
              <h3 class="ligungi-hub__group">{a.playingGroup}</h3>
              <ul class="ligungi-hub__list">{games.map(game)}</ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

/** Keeps the call's rooms up to date while the Activity is ready and the page is visible; `refresh` asks at once. */
const useCallRooms = (ready: boolean): [ActivityHallView | null, () => void] => {
  const [hall, setHall] = useState<ActivityHallView | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const refresh = () => {
      if (document.hidden) return;
      callRooms()
        .then((next) => live && setHall(next))
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, ROOMS_POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ready, tick]);
  return [hall, () => setTick((n) => n + 1)];
};

export const ActivityHub = () => {
  const state = useStore(activity);
  const people = useStore(callPeople);
  const [hall, refresh] = useCallRooms(state.status === 'ready');
  return (
    <ActivityHubView
      state={state}
      hall={hall}
      people={people}
      onOpen={async (settings) => {
        await openRoom(settings);
        refresh();
      }}
      onJoin={async (challengeId) => navigate(`/${(await joinRoom(challengeId)).gameId}`)}
      onClose={async (challengeId) => {
        await closeRoom(challengeId);
        refresh();
      }}
      onInvite={inviteToCall}
    />
  );
};
