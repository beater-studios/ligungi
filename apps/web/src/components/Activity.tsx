import { MODES, type Mode } from '@ligungi/engine';
import type { ActivityEvent, ActivityView, FeedItem } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { formatDate, timeAgo, useT } from '../i18n/index.ts';

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** The local day of a moment, as a key that sorts newest first when compared as text. */
const dayKey = (at: number): string => {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** One day of activity summed up: games per mode, studies, joining, and for the player alone their training. */
const Day = ({ events }: { events: readonly ActivityEvent[] }) => {
  const t = useT();
  const a = t.activity;
  const games = new Map<Mode, { count: number; wins: number; draws: number; losses: number; diff: number | null }>();
  let puzzles = { won: 0, total: 0, change: 0 };
  let lessons = 0;
  let practice = 0;
  const runs = new Map<'streak' | 'storm', number>();
  for (const event of events) {
    if (event.kind === 'game') {
      const entry = games.get(event.game.mode) ?? { count: 0, wins: 0, draws: 0, losses: 0, diff: null };
      entry.count++;
      entry[event.game.result === 'win' ? 'wins' : event.game.result === 'draw' ? 'draws' : 'losses']++;
      if (event.game.ratingDiff !== null) entry.diff = (entry.diff ?? 0) + event.game.ratingDiff;
      games.set(event.game.mode, entry);
    } else if (event.kind === 'puzzle') puzzles = { won: puzzles.won + (event.win ? 1 : 0), total: puzzles.total + 1, change: puzzles.change + (event.change ?? 0) };
    else if (event.kind === 'lesson') lessons++;
    else if (event.kind === 'practice') practice++;
    else if (event.kind === 'run') runs.set(event.run, Math.max(runs.get(event.run) ?? 0, event.score));
  }
  return (
    <ul class="ligungi-activity__items">
      {MODES.filter((mode) => games.has(mode)).map((mode) => {
        const entry = games.get(mode)!;
        return (
          <li key={mode} class="ligungi-activity__item is-games">
            {a.games(entry.count, t.modes[mode])}: {a.record(entry.wins, entry.draws, entry.losses)}
            {entry.diff !== null && <span class={`ligungi-activity__diff ${entry.diff >= 0 ? 'is-up' : 'is-down'}`}> {signed(entry.diff)}</span>}
          </li>
        );
      })}
      {events
        .filter((event): event is Extract<ActivityEvent, { kind: 'study' }> => event.kind === 'study')
        .map((event) => (
          <li key={event.study.id} class="ligungi-activity__item is-study">
            {a.study} <a href={`/study/${event.study.id}`}>{event.study.title}</a>
          </li>
        ))}
      {puzzles.total > 0 && (
        <li class="ligungi-activity__item is-training">
          {a.puzzles(puzzles.won, puzzles.total)}
          {puzzles.change !== 0 && <span class={`ligungi-activity__diff ${puzzles.change >= 0 ? 'is-up' : 'is-down'}`}> {signed(puzzles.change)}</span>}
        </li>
      )}
      {[...runs].map(([run, score]) => (
        <li key={run} class="ligungi-activity__item is-training">
          {a.run(run === 'streak' ? t.puzzleRuns.streak : t.puzzleRuns.storm, score)}
        </li>
      ))}
      {lessons > 0 && <li class="ligungi-activity__item is-training">{a.lessons(lessons)}</li>}
      {practice > 0 && <li class="ligungi-activity__item is-training">{a.practice(practice)}</li>}
      {events.some((event) => event.kind === 'joined') && <li class="ligungi-activity__item is-joined">{a.joined}</li>}
    </ul>
  );
};

/** A player's last 30 days, one entry per day with something in it, newest first. */
export const ActivityTimeline = ({ name }: { name: string }) => {
  const t = useT();
  const [view, setView] = useState<ActivityView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    api
      .get<ActivityView>(`/api/users/${name}/activity`)
      .then(setView)
      .catch((err: Error) => setError(err.message));
  }, [name]);

  const days = new Map<string, ActivityEvent[]>();
  for (const event of view?.events ?? []) days.set(dayKey(event.at), [...(days.get(dayKey(event.at)) ?? []), event]);

  return (
    <section class="ligungi-card ligungi-activity">
      <header class="ligungi-activity__head">
        <h2>{t.activity.title}</h2>
        <span class="ligungi-activity__intro">{t.activity.intro}</span>
      </header>
      {error && <p class="error">{error}</p>}
      {!view && !error && <p class="ligungi-notice">{t.common.loading}</p>}
      {view && days.size === 0 && <p class="ligungi-notice">{t.activity.empty}</p>}
      {view && days.size > 0 && (
        <ol class="ligungi-activity__days">
          {[...days].map(([key, events]) => (
            <li key={key} class="ligungi-activity__day">
              <h3>{formatDate(t, events[0]!.at)}</h3>
              <Day events={events} />
            </li>
          ))}
        </ol>
      )}
      {view?.mine && <p class="ligungi-activity__note">{t.activity.privateNote}</p>}
    </section>
  );
};

/** What the followed players did lately: a game won, lost or drawn, a study published. */
export const FeedList = ({ items, limit }: { items: readonly FeedItem[]; limit?: number }) => {
  const t = useT();
  const a = t.activity;
  return (
    <ul class="ligungi-feed">
      {items.slice(0, limit ?? items.length).map((item) => {
        const { event } = item;
        const who = <a href={`/@/${item.user.name}`}>{item.user.name}</a>;
        if (event.kind === 'study') {
          return (
            <li key={`s${event.study.id}`}>
              {who} {a.feedStudy} <a href={`/study/${event.study.id}`}>{event.study.title}</a> <small>{timeAgo(t, event.at)}</small>
            </li>
          );
        }
        const { game } = event;
        const phrase = { win: a.feedWon, loss: a.feedLost, draw: a.feedDrew }[game.result];
        return (
          <li key={`g${game.id}${item.user.id}`}>
            {who} <a href={`/${game.id}`}>{phrase(game.opponent.name, t.modes[game.mode])}</a> <small>{timeAgo(t, event.at)}</small>
          </li>
        );
      })}
    </ul>
  );
};

/** The feed of the signed-in player, loaded once. */
export const useFeed = (signedIn: boolean): FeedItem[] | null => {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    api
      .get<FeedItem[]>('/api/feed')
      .then(setItems)
      .catch(() => setItems([]));
  }, [signedIn]);
  return items;
};
