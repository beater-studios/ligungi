import { MODES, opposite, type Color, type Mode } from '@ligungi/engine';
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
import { CreateGame } from '../components/CreateGame.tsx';
import { Select } from '../components/ui.tsx';
import { formatDate, playerName, speedText, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';

const PAGE = 20;

type GameResult = 'win' | 'loss' | 'draw' | 'aborted';

const resultOf = (game: GameSummary, color: Color): GameResult => {
  if (game.status === 'aborted') return 'aborted';
  const winner = game.outcome?.winner;
  if (!winner) return 'draw';
  return winner === color ? 'win' : 'loss';
};

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0');

/** One finished game from the profile owner's side: result, opponent, how it went, rating change and date. */
const GameRow = ({ game, userId }: { game: GameSummary; userId: string }) => {
  const t = useT();
  const color: Color = game.players.white.user?.id === userId ? 'white' : 'black';
  const own = game.players[color];
  const opponent = game.players[opposite(color)];
  const result = resultOf(game, color);
  const label = { win: t.profile.resultWin, loss: t.profile.resultLoss, draw: t.profile.resultDraw, aborted: t.profile.resultAborted }[result];
  const reason = game.outcome ? t.reasons[game.outcome.reason] : null;
  const meta = [
    t.modes[game.mode],
    speedText(t, game),
    game.rated ? t.rated : t.casual,
    ...(reason ? [`${reason} · ${t.profile.moves(game.plies)}`] : []),
  ].join(' · ');
  return (
    <li>
      <a class={`ligungi-game-row ligungi-game-row--${result}`} href={`/${game.id}`}>
        <span class="ligungi-game-row__result">{label}</span>
        <span class="ligungi-game-row__main">
          <span class="ligungi-game-row__opponent">
            {t.profile.against(playerName(t, opponent))}
            {opponent.rating !== null && <span class="ligungi-game-row__rating"> {opponent.rating}</span>}
          </span>
          <span class="ligungi-game-row__meta">{meta}</span>
        </span>
        <span class="ligungi-game-row__diff">{own.ratingDiff !== null ? signed(own.ratingDiff) : ''}</span>
        <span class="ligungi-game-row__date">{formatDate(t, game.createdAt)}</span>
      </a>
    </li>
  );
};

/** Rating, leaderboard position and the wins, draws and losses of one mode, linking to that mode's ranking. */
const RatingCard = ({ profile, mode }: { profile: UserProfile; mode: Mode }) => {
  const t = useT();
  const rating = profile.ratings[mode];
  const rank = profile.ranks[mode];
  const { wins, draws, losses } = profile.records[mode];
  const total = wins + draws + losses;
  const share = (n: number) => `${(n / total) * 100}%`;
  return (
    <a class={`ligungi-card ligungi-rating-card${rating.games ? '' : ' ligungi-rating-card--empty'}`} href={`/ranking/${mode}`}>
      <span class="ligungi-rating-card__head">
        <span class="ligungi-rating-card__mode">{t.modes[mode]}</span>
        <span class="ligungi-rating-card__rank">{rank !== null ? `#${rank}` : rating.games ? t.profile.provisional : ''}</span>
      </span>
      <strong class="ligungi-rating-card__rating">
        {rating.rating}
        {rating.provisional ? '?' : ''}
      </strong>
      <span class="ligungi-rating-card__games">{t.profile.ratedGames(rating.games)}</span>
      {total > 0 && (
        <>
          <span class="ligungi-rating-card__bar" aria-hidden="true">
            <span class="win" style={{ width: share(wins) }} />
            <span class="draw" style={{ width: share(draws) }} />
            <span class="loss" style={{ width: share(losses) }} />
          </span>
          <span class="ligungi-rating-card__record">{t.profile.record(wins, draws, losses)}</span>
        </>
      )}
    </a>
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

/** Mode chips, then color and opponent; the result and rated filters live in the tabs above. */
const FilterForm = ({ name, filters }: { name: string; filters: GameFilters }) => {
  const t = useT();
  const [vs, setVs] = useState(filters.vs ?? '');
  useEffect(() => setVs(filters.vs ?? ''), [filters.vs]);
  const go = (patch: { [K in keyof GameFilters]?: GameFilters[K] | undefined }) => {
    const next: Record<string, unknown> = { ...filters, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === '') delete next[key];
    navigate(hrefFor(name, next as GameFilters), false, false);
  };
  const { mode, ...withoutMode } = filters;
  const active = Object.keys(filters).length > 0;
  return (
    <div class="ligungi-history-filters">
      <nav class="ligungi-chips" aria-label={t.common.mode}>
        <a class={`ligungi-chip${mode ? '' : ' active'}`} href={hrefFor(name, withoutMode)}>
          {t.profile.allModes}
        </a>
        {MODES.map((m) => (
          <a key={m} class={`ligungi-chip${mode === m ? ' active' : ''}`} href={hrefFor(name, { ...withoutMode, mode: m })}>
            {t.modes[m]}
          </a>
        ))}
      </nav>
      <form
        class="form3 ligungi-history-filters__form"
        onSubmit={(e) => {
          e.preventDefault();
          go({ vs: vs.trim() || undefined });
        }}
      >
        <Select
          ariaLabel={t.common.yourColor}
          value={filters.color ?? ''}
          options={[
            { value: '', label: t.profile.anyColor },
            { value: 'white', label: t.colors.white },
            { value: 'black', label: t.colors.black },
          ]}
          onChange={(value) => go({ color: (value || undefined) as GameFilters['color'] })}
        />
        <input
          class="form-control"
          type="search"
          placeholder={t.profile.opponent}
          aria-label={t.profile.opponent}
          maxLength={20}
          value={vs}
          onInput={(e) => setVs((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="button button-empty">
          {t.profile.filter}
        </button>
        {active && (
          <a class="ligungi-history-filters__clear" href={`/@/${name}`}>
            {t.profile.clearFilters}
          </a>
        )}
      </form>
    </div>
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
  const [challenging, setChallenging] = useState(false);

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
  if (!profile) return <main class="ligungi-page ligungi-profile" />;

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
      <a class={activeTab ? 'active' : ''} href={hrefFor(profile.user.name, { ...rest, ...patch })}>
        {label} <strong>{count}</strong>
      </a>
    );
  };

  return (
    <main class="ligungi-page ligungi-profile">
      <section class="ligungi-card ligungi-profile__hero">
        <span class={`ligungi-avatar ligungi-avatar--large${profile.online ? ' ligungi-avatar--online' : ''}`} aria-hidden="true">
          {profile.user.name.charAt(0).toUpperCase()}
        </span>
        <div class="ligungi-profile__identity">
          <h1>{profile.user.name}</h1>
          <p class="ligungi-profile__since">
            <span class={profile.online ? 'ligungi-profile__online' : ''}>{profile.online ? t.common.online : t.common.offline}</span> ·{' '}
            {t.profile.memberSince(formatDate(t, profile.createdAt))}
          </p>
          <p>
            <strong>{profile.followers}</strong> {t.profile.followers(profile.followers)} · <strong>{profile.following}</strong>{' '}
            {t.profile.following}
            {!isMe && me && (
              <>
                {' · '}
                <a href={hrefFor(me.name, { vs: profile.user.name })}>{t.profile.vsLink}</a>
              </>
            )}
          </p>
        </div>
        <div class="ligungi-profile__actions">
          {!isMe && me && (
            <button
              type="button"
              class="button text ligungi-button-good"
              data-icon={icons.Swords}
              disabled={!profile.canChallenge}
              title={profile.canChallenge ? '' : t.profile.challengeRefused}
              onClick={() => setChallenging(true)}
            >
              {t.profile.challenge}
            </button>
          )}
          {!isMe && me && (
            <button
              type="button"
              class="button button-empty text"
              data-icon={profile.followed ? icons.X : icons.User}
              disabled={busy}
              onClick={toggleFollow}
            >
              {profile.followed ? t.profile.unfollow : t.profile.follow}
            </button>
          )}
          {!isMe && !me && (
            <a class="button button-empty text" href="/login" title={t.profile.loginToFollow} data-icon={icons.User}>
              {t.profile.follow}
            </a>
          )}
        </div>
      </section>

      <section class="ligungi-profile__ratings" aria-label={t.profile.ratingsLabel}>
        {MODES.map((mode) => (
          <RatingCard key={mode} profile={profile} mode={mode} />
        ))}
      </section>

      {profile.playing.map((game) => (
        <section key={game.id} class="ligungi-card ligungi-live-strip">
          <span class="ligungi-live-badge">{t.profile.live}</span>
          <span class="ligungi-live-strip__text">
            {playerName(t, game.players.white)} × {playerName(t, game.players.black)} · {t.modes[game.mode]} ·{' '}
            {speedText(t, game)}
          </span>
          <a class="button" href={`/${game.id}`}>
            {t.profile.watch}
          </a>
        </section>
      ))}

      <section class="ligungi-card ligungi-profile__games">
        <div class="ligungi-profile__games-head">
          <h2>{t.profile.gamesTitle}</h2>
          <nav class="ligungi-segmented" aria-label={t.profile.result}>
            {tab(t.profile.tabAll, counts.games, {})}
            {tab(t.profile.tabRated, counts.rated, { rated: true })}
            {tab(t.profile.tabWins, counts.wins, { result: 'win' })}
            {tab(t.profile.tabLosses, counts.losses, { result: 'loss' })}
            {tab(t.profile.tabDraws, counts.draws, { result: 'draw' })}
          </nav>
        </div>
        <FilterForm name={profile.user.name} filters={filters} />
        {games === null && <p class="ligungi-notice ligungi-profile__empty">{t.common.loading}</p>}
        {games?.length === 0 && (
          <p class="ligungi-notice ligungi-profile__empty">{filterKey ? t.profile.noMatch : t.profile.noGames}</p>
        )}
        {games && games.length > 0 && (
          <ul class="ligungi-game-list">
            {games.map((game) => (
              <GameRow key={game.id} game={game} userId={profile.user.id} />
            ))}
          </ul>
        )}
        {more && games && games.length > 0 && (
          <div class="ligungi-profile__more">
            <button type="button" class="button button-empty" onClick={loadMore}>
              {t.profile.loadMore}
            </button>
          </div>
        )}
      </section>
      {challenging && <CreateGame target="friend" to={profile.user.name} onClose={() => setChallenging(false)} />}
    </main>
  );
};
