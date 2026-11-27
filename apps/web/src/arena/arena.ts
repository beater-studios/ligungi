import { arenaPrizes, type ArenaList, type ArenaView, type TrophyView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { socket } from '../core/socket.ts';
import { formatClock, formatDate, type Messages } from '../i18n/index.ts';

/** A start time in the reader's language and time zone: "Saturday, 5 Dec, 15:00". */
export const arenaTime = (t: Messages, ms: number): string =>
  new Date(ms).toLocaleString(t.locale, { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A countdown: days and hours when far, then h:mm:ss or m:ss; never the tenths a game clock shows. */
export const countdown = (ms: number): string => {
  if (ms >= 24 * 3_600_000) return formatClock(ms);
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** The reader's time zone, as the browser names it. */
export const timeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/** Which trophies an Arena with this many players gives, as the `select` key of the messages. */
export const prizeKey = (players: number): 'champion' | 'podium' | 'top' => {
  const prizes = arenaPrizes(players);
  return prizes.top ? 'top' : prizes.podium ? 'podium' : 'champion';
};

/** What a pointer over a trophy shows: its name, the place among how many players, and the Arena's date. */
export const trophyTitle = (t: Messages, trophy: Pick<TrophyView, 'kind' | 'place' | 'players' | 'at'>): string =>
  `${t.arena.trophies[trophy.kind]} · ${t.arena.place(trophy.place, trophy.players)} · ${t.arena.trophyContext(formatDate(t, trophy.at))}`;

/** A clock that moves every second while `on`, for the countdowns. */
export const useNow = (on = true): number => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [on]);
  return now;
};

/**
 * An Arena followed live: `id` names one, or, without it, the one running or the next. Also returns the latest finished
 * ones when following the current Arena.
 */
export const useArena = (id: string | null) => {
  const [view, setView] = useState<ArenaView | null>(null);
  const [recent, setRecent] = useState<ArenaList['recent']>([]);
  const [missing, setMissing] = useState(false);
  const [current, setCurrent] = useState<string | null>(id);

  useEffect(() => {
    let live = true;
    setView(null);
    setMissing(false);
    if (id) {
      setCurrent(id);
      api
        .get<ArenaView>(`/api/arena/${id}`)
        .then((arena) => live && setView(arena))
        .catch(() => live && setMissing(true));
    } else {
      api
        .get<ArenaList>('/api/arena')
        .then((list) => {
          if (!live) return;
          setRecent(list.recent);
          setView(list.current);
          setCurrent(list.current?.id ?? null);
          if (!list.current) setMissing(true);
        })
        .catch(() => live && setMissing(true));
    }
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!current) return;
    const unsubscribe = socket.subscribe(`arena:${current}`);
    const off = socket.on((message) => {
      if (message.t === 'arena' && message.arena.id === current) setView(message.arena);
    });
    return () => {
      unsubscribe();
      off();
    };
  }, [current]);

  return { view, setView, recent, missing };
};
