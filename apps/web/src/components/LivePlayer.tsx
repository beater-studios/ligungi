import type { Color } from '@ligungi/engine';
import type { ClockView, GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { formatClock, playerName, useT } from '../i18n/index.ts';

/** A clock that keeps ticking between updates, from the time left when the summary arrived. */
const LiveClock = ({ clock, color, since }: { clock: ClockView; color: Color; since: number }) => {
  const running = clock.running === color;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [running, since]);
  const left = running ? Math.max(0, clock[color] - (performance.now() - since)) : clock[color];
  return <span class={`ligungi-live-player__clock${running ? ' is-running' : ''}`}>{formatClock(left)}</span>;
};

/** One side of a live game in a list (TV, home page): name, rating and clock. */
export const LivePlayer = ({ game, color, since }: { game: GameSummary; color: Color; since: number }) => {
  const t = useT();
  const player = game.players[color];
  return (
    <span class="ligungi-live-player">
      <span class="ligungi-live-player__name">
        {playerName(t, player)}
        {player.rating !== null && <span class="ligungi-live-player__rating">{player.rating}</span>}
      </span>
      {game.clock && <LiveClock clock={game.clock} color={color} since={since} />}
    </span>
  );
};
