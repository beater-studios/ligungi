import type { AppDeps } from './app.ts';
import { ACTIVITY_DAYS, ACTIVITY_MAX, DAY_MS, FEED_DAYS, FEED_MAX, type ActivityEvent, type ActivityView, type FeedItem } from '@ligungi/protocol';
import type { UserRecord } from './users.ts';

/** A player's recent activity on their profile: games, studies, joining, and for the player themself their training too. */
export const profileActivity = (deps: AppDeps, user: UserRecord, mine: boolean): ActivityView => {
  const { config, games, puzzles, studies, users } = deps;
  const since = config.now() - ACTIVITY_DAYS * DAY_MS;
  const events: ActivityEvent[] = [
    ...games.history.activityGames([user.id], since, ACTIVITY_MAX).map(({ at, game }): ActivityEvent => ({ kind: 'game', at, game })),
    ...studies.createdBy([user.id], since, ACTIVITY_MAX).map(({ id, title, at }): ActivityEvent => ({ kind: 'study', at, study: { id, title } })),
    ...(user.createdAt >= since ? [{ kind: 'joined', at: user.createdAt } as const] : []),
    ...(mine ? [...puzzles.activitySince(user.id, since), ...users.training.trainingSince(user.id, since)] : []),
  ];
  return { events: events.sort((a, b) => b.at - a.at).slice(0, ACTIVITY_MAX), mine };
};

/** The latest games and studies of the players `userId` follows, newest first. */
export const followingFeed = (deps: AppDeps, userId: string): FeedItem[] => {
  const { config, games, studies, users } = deps;
  const names = new Map(users.social.following(userId).map((user) => [user.id, user.name]));
  const followed = [...names.keys()];
  const since = config.now() - FEED_DAYS * DAY_MS;
  // A game between two followed players is told once, from the side of the first one found.
  const seen = new Set<string>();
  const played = games.history.activityGames(followed, since, FEED_MAX * 2).filter(({ game }) => !seen.has(game.id) && Boolean(seen.add(game.id)));
  const items: FeedItem[] = [
    ...played.map(({ userId: id, at, game }): FeedItem => ({ user: { id, name: names.get(id) ?? '' }, event: { kind: 'game', at, game } })),
    ...studies
      .createdBy(followed, since, FEED_MAX)
      .map(({ ownerId, ownerName, id, title, at }): FeedItem => ({ user: { id: ownerId, name: ownerName }, event: { kind: 'study', at, study: { id, title } } })),
  ];
  return items.sort((a, b) => b.event.at - a.event.at).slice(0, FEED_MAX);
};
