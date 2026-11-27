import type { ArenaList, ArenaView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { arenaTime, countdown, useNow } from '../../arena/arena.ts';
import { Trophy } from '../../arena/Trophy.tsx';
import { api } from '../../core/api.ts';
import { speedText, useT } from '../../i18n/index.ts';

/** How often the home page asks again, so the box turns from "next" to "in progress" on its own. */
const REFRESH_MS = 60_000;

/** The weekly Arena on the home page: when the next one starts, or that one is running, with a button to it. */
export const NextArena = () => {
  const t = useT();
  const a = t.arena;
  const [arena, setArena] = useState<ArenaView | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .get<ArenaList>('/api/arena')
        .then((list) => live && setArena(list.current))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const now = useNow(arena !== null);
  if (!arena) return null;
  const running = arena.status === 'started';
  const joined = arena.standings.length;
  return (
    <section class={`ligungi-card ligungi-home__arena${running ? ' is-live' : ''}`}>
      <div class="ligungi-home__arena-head">
        <Trophy kind="arenaChampion" size={36} />
        <div>
          <span class="ligungi-home__arena-label">{running ? a.homeLive : a.homeNext}</span>
          <h2>{a.title}</h2>
        </div>
      </div>
      <p>
        {running && arena.endsAt !== null
          ? `${a.homeEnds(countdown(arena.endsAt - now))} · ${a.homePlaying(arena.standings.filter((s) => s.state === 'playing').length)}`
          : `${arenaTime(t, arena.startsAt)} · ${a.homeStarts(countdown(arena.startsAt - now))}`}
      </p>
      <p class="ligungi-home__arena-meta">
        {[t.modes[arena.mode], speedText(t, { timeControl: arena.timeControl, daysPerMove: null }), a.minutes(arena.durationMinutes), t.rated, a.homeJoined(joined)].join(' · ')}
      </p>
      <a class={`button${running ? ' ligungi-button-good' : ''}`} href={`/arena/${arena.id}`}>
        {running ? a.enterNow : arena.you?.joined ? a.open : a.join}
      </a>
    </section>
  );
};
