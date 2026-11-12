import { MODES } from '@ligungi/engine';
import type { FriendView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { useT } from '../i18n/index.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';

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
    if (!user) {
      setFriends(null);
      return;
    }
    let alive = true;
    const load = () =>
      api
        .get<FriendView[]>('/api/following')
        .then((list) => alive && setFriends(sortFriends(list)))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [user?.id]);
  return friends;
};

export const FriendsPage = () => {
  const t = useT();
  const { user } = useStore(session);
  const friends = useFriends();

  return (
    <main class="page-menu">
      <nav class="page-menu__menu subnav">
        <a class="active" href="/friends">
          {t.friends.title}
        </a>
        <a href="/ranking">{t.nav.players}</a>
      </nav>
      <div class="page-menu__content box">
        <h1 class="box__top">{friends ? t.friends.following(friends.length) : t.friends.title}</h1>
        {!user && <p class="box__pad">{t.friends.login}</p>}
        {user && !friends && <p class="box__pad ligungi-notice">{t.common.loading}</p>}
        {friends?.length === 0 && <p class="box__pad ligungi-notice">{t.friends.empty}</p>}
        {friends && friends.length > 0 && (
          <table class="slist slist-pad ligungi-friends">
            <thead>
              <tr>
                <th>{t.ranking.player}</th>
                <th>{t.friends.status}</th>
                {MODES.map((mode) => (
                  <th key={mode}>{t.modes[mode]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {friends.map((friend) => (
                <tr key={friend.user.id}>
                  <td>
                    <a class={`user-link ${friend.online ? 'online' : 'offline'}`} href={`/@/${friend.user.name}`}>
                      <i class="line" />
                      {friend.user.name}
                    </a>
                  </td>
                  <td>
                    {friend.playing ? (
                      <a href={`/${friend.playing}`}>
                        {t.friends.playing} · {t.friends.watch}
                      </a>
                    ) : friend.online ? (
                      t.common.online
                    ) : (
                      <span class="ligungi-notice">{t.common.offline}</span>
                    )}
                  </td>
                  {MODES.map((mode) => {
                    const rating = friend.ratings[mode];
                    return (
                      <td key={mode} class={rating.games ? '' : 'ligungi-notice'}>
                        {rating.games ? `${rating.rating}${rating.provisional ? '?' : ''}` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
};
