import type { FriendView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { usePolling } from '../core/hooks.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';

const REFRESH_MS = 20_000;

/** Online friends first, then those playing, then by name. */
export const sortFriends = (list: readonly FriendView[]): FriendView[] =>
  [...list].sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      Number(Boolean(b.playing)) - Number(Boolean(a.playing)) ||
      a.user.name.localeCompare(b.user.name),
  );

/** Followed players, refreshed periodically while the user is signed in. */
export const useFriends = (): FriendView[] | null => {
  const { user } = useStore(session);
  const [friends, setFriends] = useState<FriendView[] | null>(null);
  useEffect(() => {
    if (!user) setFriends(null);
  }, [user?.id]);
  usePolling(
    (alive) =>
      api
        .get<FriendView[]>('/api/following')
        .then((list) => alive() && setFriends(sortFriends(list)))
        .catch(() => {}),
    REFRESH_MS,
    [user?.id],
    user !== null,
  );
  return friends;
};
