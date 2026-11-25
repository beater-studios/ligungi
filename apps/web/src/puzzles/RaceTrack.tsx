import type { RaceGhostView, RacePlayerView } from '@ligungi/protocol';
import { useT } from '../i18n/index.ts';
import { ghostScore, racerName } from './racer.ts';

/** The track's length in points: a good race reaches about this far, and a better one stretches it. */
const TRACK_POINTS = 40;

interface Lane {
  readonly key: string;
  readonly name: string;
  readonly score: number;
  readonly me: boolean;
  readonly ghost: boolean;
}

interface RaceTrackProps {
  readonly players: readonly RacePlayerView[];
  /** Ghosts to show; empty when the player turned them off. */
  readonly ghosts: readonly RaceGhostView[];
  /** Milliseconds since the start, to place the ghosts. */
  readonly elapsed: number;
  /** Once over, the lanes are sorted by score. */
  readonly over: boolean;
}

/** One lane per racer, its marker as far along as its score; ghosts run in lighter lanes at the pace they had. */
export const RaceTrack = ({ players, ghosts, elapsed, over }: RaceTrackProps) => {
  const t = useT();
  const lanes: Lane[] = [
    ...players.map((player, i) => ({ key: `p${i}`, name: racerName(t, player), score: player.score, me: player.me, ghost: false })),
    ...ghosts.map((ghost, i) => ({ key: `g${i}`, name: racerName(t, ghost), score: ghostScore(ghost, elapsed), me: false, ghost: true })),
  ];
  if (over) lanes.sort((a, b) => b.score - a.score);
  const length = Math.max(TRACK_POINTS, ...lanes.map((lane) => lane.score + 4));
  return (
    <ol class="ligungi-race__track" aria-label={t.racer.players}>
      {lanes.map((lane) => (
        <li key={lane.key} class={`ligungi-race__lane${lane.me ? ' is-me' : ''}${lane.ghost ? ' is-ghost' : ''}`}>
          <span class="ligungi-race__name">
            {lane.name}
            {lane.me && <span class="ligungi-race__tag">{t.common.you}</span>}
            {lane.ghost && <span class="ligungi-race__tag">{t.racer.ghostTag}</span>}
          </span>
          <span class="ligungi-race__road" aria-hidden="true">
            <span class="ligungi-race__marker" style={{ left: `${(lane.score / length) * 100}%` }} />
          </span>
          <span class="ligungi-race__score">{lane.score}</span>
        </li>
      ))}
    </ol>
  );
};
