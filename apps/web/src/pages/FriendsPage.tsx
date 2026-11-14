import { MODES, type Mode } from '@ligungi/engine';
import type { FriendView } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { CreateGame } from '../components/CreateGame.tsx';
import { Checkbox, Select } from '../components/ui.tsx';
import { useT } from '../i18n/index.ts';
import { CommunityNav } from './PlayersPage.tsx';
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

const FriendRow = ({ friend, mode, onChallenge }: { friend: FriendView; mode: Mode; onChallenge: (name: string) => void }) => {
  const t = useT();
  const rating = (m: Mode) => {
    const r = friend.ratings[m];
    return r.games ? `${r.rating}${r.provisional ? '?' : ''}` : '·';
  };
  const status = friend.playing ? t.friends.playing : friend.online ? t.common.online : t.common.offline;
  const statusClass = friend.playing ? 'is-playing' : friend.online ? 'is-online' : 'is-offline';
  return (
    <li class="ligungi-friend-row">
      <a class={`user-link ${friend.online ? 'online' : 'offline'} ligungi-friend-row__player`} href={`/@/${friend.user.name}`}>
        <i class="line" />
        {friend.user.name}
      </a>
      <span class={`ligungi-friend-row__status ${statusClass}`}>{status}</span>
      {MODES.map((m) => (
        <span key={m} class={`ligungi-friend-row__rating${friend.ratings[m].games ? '' : ' is-empty'}`}>
          {rating(m)}
        </span>
      ))}
      {/* Phones: status and the chosen mode's rating under the name. */}
      <span class="ligungi-friend-row__meta">
        <span class={statusClass}>{status}</span> · {rating(mode)}
      </span>
      <span class="ligungi-friend-row__action">
        {friend.playing ? (
          <a class="button" href={`/${friend.playing}`}>
            {t.friends.watch}
          </a>
        ) : friend.online && friend.canChallenge ? (
          <button type="button" class="button ligungi-button-good" onClick={() => onChallenge(friend.user.name)}>
            {t.profile.challenge}
          </button>
        ) : null}
      </span>
    </li>
  );
};

/** The players the viewer follows, with presence, ratings in every mode and a way to challenge or watch them. */
export const FriendsPage = () => {
  const t = useT();
  const { user } = useStore(session);
  const friends = useFriends();
  const [onlineFirst, setOnlineFirst] = useState(true);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('advanced');
  const [challenging, setChallenging] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const list = (friends ?? []).filter((friend) => !needle || friend.user.name.toLowerCase().includes(needle));
  const shown = onlineFirst ? list : [...list].sort((a, b) => a.user.name.localeCompare(b.user.name));
  const online = (friends ?? []).filter((friend) => friend.online).length;

  return (
    <main class="ligungi-page ligungi-friends-page">
      <CommunityNav active="friends" />
      {!user && (
        <section class="ligungi-card ligungi-friends-page__note">
          <h1>{t.friends.title}</h1>
          <p>{t.friends.login}</p>
        </section>
      )}
      {user && !friends && <p class="ligungi-notice">{t.common.loading}</p>}
      {friends?.length === 0 && (
        <section class="ligungi-card ligungi-friends-page__note">
          <h1>{t.friends.title}</h1>
          <p>{t.friends.empty}</p>
        </section>
      )}
      {friends && friends.length > 0 && (
        <section class="ligungi-card ligungi-friends-page__list">
          <div class="ligungi-friends-page__filters">
            <h1>{t.friends.title}</h1>
            <span class="ligungi-friends-page__summary">{t.friends.summary(friends.length, online)}</span>
            <Checkbox id="fr-online" checked={onlineFirst} label={t.friends.onlineFirst} onChange={setOnlineFirst} />
            <Select
              ariaLabel={t.players.ratingOf}
              value={mode}
              options={MODES.map((m) => ({ value: m, label: `${t.players.ratingOf} ${t.modes[m]}` }))}
              onChange={setMode}
            />
            <input
              class="form-control"
              type="search"
              placeholder={t.players.search}
              aria-label={t.players.search}
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          {shown.length === 0 ? (
            <p class="ligungi-notice ligungi-friends-page__empty">{t.friends.noMatch}</p>
          ) : (
            <ul class="ligungi-friend-list">
              <li class="ligungi-friend-row ligungi-friend-row--head" aria-hidden="true">
                <span>{t.ranking.player}</span>
                <span>{t.friends.status}</span>
                {MODES.map((m) => (
                  <span key={m}>{t.modes[m]}</span>
                ))}
                <span />
              </li>
              {shown.map((friend) => (
                <FriendRow key={friend.user.id} friend={friend} mode={mode} onChallenge={setChallenging} />
              ))}
            </ul>
          )}
        </section>
      )}
      {user && <p class="ligungi-friends-page__hint">{t.friends.hint}</p>}
      {challenging && <CreateGame target="friend" to={challenging} onClose={() => setChallenging(null)} />}
    </main>
  );
};
