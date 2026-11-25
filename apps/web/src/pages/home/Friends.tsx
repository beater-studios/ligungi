import { FeedList, useFeed } from '../../components/ActivityFeed.tsx';
import { useT } from '../../i18n/index.ts';
import { icons } from '../../icons.ts';
import { useFriends } from '../../friends.ts';

export const OnlineFriends = () => {
  const t = useT();
  const friends = useFriends();
  const online = friends?.filter((friend) => friend.online) ?? [];
  if (online.length === 0) return null;
  return (
    <section class="ligungi-card ligungi-home__friends">
      <div class="ligungi-home__card-head">
        <h2>{t.friends.onlineBox}</h2>
        <a href="/friends">{online.length}</a>
      </div>
      <ul>
        {online.map((friend) => (
          <li key={friend.user.id}>
            <a class="user-link online" href={`/@/${friend.user.name}`}>
              <i class="line" />
              {friend.user.name}
            </a>
            {friend.playing && <a class="ligungi-home__friend-watch" href={`/${friend.playing}`} title={t.friends.watch} data-icon={icons.Eye} />}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** The latest of the followed players, kept short on the home page; the whole feed is on the friends page. */
const HOME_FEED = 5;

export const FollowFeed = () => {
  const t = useT();
  const items = useFeed(true);
  if (!items || items.length === 0) return null;
  return (
    <section class="ligungi-card ligungi-home__feed">
      <div class="ligungi-home__card-head">
        <h2>{t.activity.feedTitle}</h2>
        <a href="/friends#feed">{t.activity.seeAll}</a>
      </div>
      <FeedList items={items} limit={HOME_FEED} />
    </section>
  );
};
