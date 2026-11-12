import { MODES, type Mode } from '@ligungi/engine';
import {
  gameFiltersQuery,
  isErrorCode,
  parseGameFilters,
  type GameFilters,
  type GameSummary,
  type ResultFilter,
  type UserProfile,
} from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { formatDate, outcomeText, playerName, resultSymbol, timeControlText, useT, type Messages } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';

const PAGE = 20;

const playerCell = (t: Messages, player: GameSummary['players']['white']) =>
  player.user ? <a href={`/@/${player.user.name}`}>{player.name}</a> : playerName(t, player);

const GameRow = ({ game, userId }: { game: GameSummary; userId: string }) => {
  const t = useT();
  const color = game.players.white.user?.id === userId ? 'white' : 'black';
  const won = game.outcome?.winner === color;
  const lost = Boolean(game.outcome?.winner && game.outcome.winner !== color);
  return (
    <tr>
      <td>
        <a href={`/${game.id}`}>{formatDate(t, game.createdAt)}</a>
      </td>
      <td>{playerCell(t, game.players.white)}</td>
      <td>{playerCell(t, game.players.black)}</td>
      <td class={won ? 'win' : lost ? 'loss' : ''} title={outcomeText(t, game.outcome, game.status === 'aborted')}>
        {game.status === 'aborted' ? t.profile.abortedShort : resultSymbol(game.outcome)}
      </td>
      <td>
        {t.modes[game.mode]} · {timeControlText(t, game.timeControl)}
        {game.rated ? '' : ` · ${t.profile.casualShort}`}
      </td>
    </tr>
  );
};

const readFilters = (search: string): GameFilters => {
  const parsed = parseGameFilters(new URLSearchParams(search));
  return isErrorCode(parsed) ? {} : parsed;
};

const hrefFor = (name: string, filters: GameFilters) => {
  const query = gameFiltersQuery(filters).toString();
  return `/@/${name}${query ? `?${query}` : ''}`;
};

/** Mode, color and opponent filters; the result and rated filters live in the tabs. */
const FilterForm = ({ name, filters }: { name: string; filters: GameFilters }) => {
  const t = useT();
  const [vs, setVs] = useState(filters.vs ?? '');
  useEffect(() => setVs(filters.vs ?? ''), [filters.vs]);
  const go = (patch: { [K in keyof GameFilters]?: GameFilters[K] | undefined }) => {
    const next: Record<string, unknown> = { ...filters, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === '') delete next[key];
    navigate(hrefFor(name, next as GameFilters), false, false);
  };
  const active = Object.keys(filters).length > 0;
  return (
    <form
      class="form3 ligungi-history-filters"
      onSubmit={(e) => {
        e.preventDefault();
        go({ vs: vs.trim() || undefined });
      }}
    >
      <select
        class="form-control"
        aria-label={t.common.mode}
        value={filters.mode ?? ''}
        onChange={(e) => go({ mode: ((e.target as HTMLSelectElement).value || undefined) as Mode | undefined })}
      >
        <option value="">{t.profile.allModes}</option>
        {MODES.map((mode) => (
          <option key={mode} value={mode}>
            {t.modes[mode]}
          </option>
        ))}
      </select>
      <select
        class="form-control"
        aria-label={t.common.yourColor}
        value={filters.color ?? ''}
        onChange={(e) => go({ color: ((e.target as HTMLSelectElement).value || undefined) as GameFilters['color'] })}
      >
        <option value="">{t.profile.anyColor}</option>
        <option value="white">{t.colors.white}</option>
        <option value="black">{t.colors.black}</option>
      </select>
      <input
        class="form-control"
        placeholder={t.profile.opponent}
        aria-label={t.profile.opponent}
        maxLength={20}
        value={vs}
        onInput={(e) => setVs((e.target as HTMLInputElement).value)}
      />
      <button type="submit" class="button">
        {t.profile.filter}
      </button>
      {active && (
        <a class="button button-empty" href={`/@/${name}`}>
          {t.profile.clearFilters}
        </a>
      )}
    </form>
  );
};

export const ProfilePage = ({ name }: { name: string }) => {
  const t = useT();
  const { user: me } = useStore(session);
  const { search } = useLocation();
  const filters = readFilters(search);
  const filterKey = gameFiltersQuery(filters).toString();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; games: GameSummary[] } | null>(null);
  const games = loaded?.key === `${name}?${filterKey}` ? loaded.games : null;
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfile(null);
    setError(null);
    api
      .get<UserProfile>(`/api/users/${encodeURIComponent(name)}`)
      .then(setProfile)
      .catch((err: Error) => setError(err.message));
  }, [name, me?.id]);

  const gamesUrl = (before?: number) => {
    const params = new URLSearchParams(filterKey);
    if (before) params.set('before', String(before));
    const query = params.toString();
    return `/api/users/${encodeURIComponent(name)}/games${query ? `?${query}` : ''}`;
  };

  useEffect(() => {
    let alive = true;
    const key = `${name}?${filterKey}`;
    api
      .get<GameSummary[]>(gamesUrl())
      .then((list) => {
        if (!alive) return;
        setLoaded({ key, games: list });
        setMore(list.length === PAGE);
      })
      .catch(() => alive && setLoaded({ key, games: [] }));
    return () => {
      alive = false;
    };
  }, [name, filterKey]);

  if (error) {
    return (
      <main class="page-small box box-pad page">
        <h1 class="box__top">{name}</h1>
        <p class="error">{error}</p>
      </main>
    );
  }
  if (!profile) return <main class="page-menu" />;

  const loadMore = async () => {
    const last = games?.[games.length - 1];
    if (!last) return;
    const next = await api.get<GameSummary[]>(gamesUrl(last.createdAt));
    setLoaded((current) => current && { ...current, games: [...current.games, ...next] });
    setMore(next.length === PAGE);
  };

  const toggleFollow = async () => {
    setBusy(true);
    try {
      const path = `/api/users/${encodeURIComponent(profile.user.name)}/follow`;
      const result = profile.followed
        ? await api.delete<{ followed: boolean; followers: number }>(path)
        : await api.post<{ followed: boolean; followers: number }>(path);
      setProfile({ ...profile, followed: result.followed, followers: result.followers });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const { counts } = profile;
  const isMe = me?.id === profile.user.id;
  const { result, rated, ...rest } = filters;
  const tab = (label: string, count: number, patch: { result?: ResultFilter; rated?: boolean }) => {
    const activeTab = result === patch.result && rated === patch.rated;
    return (
      <a class={`nm-item${activeTab ? ' active' : ''}`} href={hrefFor(profile.user.name, { ...rest, ...patch })}>
        <strong>{count}</strong> {label}
      </a>
    );
  };

  return (
    <main class="page-menu">
      <aside class="page-menu__menu side sub-ratings">
        {MODES.map((mode) => {
          const rating = profile.ratings[mode];
          const rank = profile.ranks[mode];
          return (
            <a key={mode} class={rating.games ? '' : 'empty'} href={`/ranking/${mode}`}>
              <span>
                <h3>{t.modes[mode]}</h3>
                <rating>
                  <strong>
                    {rating.rating}
                    {rating.provisional ? '?' : ''}
                  </strong>
                  <span>
                    {rating.games} {t.profile.games(rating.games)}
                  </span>
                  {rank !== null && <span class="ligungi-rank">{t.profile.rank(rank)}</span>}
                </rating>
              </span>
            </a>
          );
        })}
      </aside>
      <div class="page-menu__content box user-show">
        <div class="box__top user-show__header">
          <h1 class={`user-link ${profile.online ? 'online' : 'offline'}`}>
            <i class="line" title={profile.online ? t.common.online : t.common.offline} />
            {profile.user.name}
          </h1>
          <div class="ligungi-relation">
            <span class="ligungi-notice">
              <strong>{profile.followers}</strong> {t.profile.followers(profile.followers)} · <strong>{profile.following}</strong>{' '}
              {t.profile.following}
            </span>
            {!isMe && me && (
              <button
                type="button"
                class={`button ${profile.followed ? 'button-empty' : ''}`}
                data-icon={profile.followed ? icons.X : icons.User}
                disabled={busy}
                onClick={toggleFollow}
              >
                {profile.followed ? t.profile.unfollow : t.profile.follow}
              </button>
            )}
            {!isMe && !me && (
              <a class="button button-empty" href="/login" title={t.profile.loginToFollow} data-icon={icons.User}>
                {t.profile.follow}
              </a>
            )}
          </div>
        </div>
        <div class="box__pad ligungi-profile-meta">
          <span class="ligungi-notice">{t.profile.memberSince(formatDate(t, profile.createdAt))}</span>
          {!isMe && me && (
            <a href={hrefFor(me.name, { vs: profile.user.name })} data-icon={icons.Swords} class="text">
              {t.profile.vsLink}
            </a>
          )}
        </div>
        {profile.playing.length > 0 && (
          <p class="box__pad">
            {t.profile.playingNow}:{' '}
            {profile.playing.map((g) => (
              <a key={g.id} href={`/${g.id}`}>
                {playerName(t, g.players.white)} × {playerName(t, g.players.black)}{' '}
              </a>
            ))}
          </p>
        )}
        <div class="number-menu number-menu--tabs">
          {tab(t.profile.games(counts.games), counts.games, {})}
          {tab(t.profile.rated(counts.rated), counts.rated, { rated: true })}
          {tab(t.profile.wins(counts.wins), counts.wins, { result: 'win' })}
          {tab(t.profile.losses(counts.losses), counts.losses, { result: 'loss' })}
          {tab(t.profile.draws(counts.draws), counts.draws, { result: 'draw' })}
        </div>
        <FilterForm name={profile.user.name} filters={filters} />
        {games === null && <p class="box__pad ligungi-notice">{t.common.loading}</p>}
        {games?.length === 0 && (
          <p class="box__pad ligungi-notice">{filterKey ? t.profile.noMatch : t.profile.noGames}</p>
        )}
        {games && games.length > 0 && (
          <table class="slist slist-pad">
            <thead>
              <tr>
                <th>{t.profile.date}</th>
                <th>{t.colors.white}</th>
                <th>{t.colors.black}</th>
                <th>{t.profile.result}</th>
                <th>{t.profile.game}</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <GameRow key={game.id} game={game} userId={profile.user.id} />
              ))}
            </tbody>
          </table>
        )}
        {more && games && games.length > 0 && (
          <div class="box__pad">
            <button type="button" class="button button-empty" onClick={loadMore}>
              {t.profile.loadMore}
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
