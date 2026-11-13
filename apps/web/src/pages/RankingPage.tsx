import { MODES, type Mode } from '@ligungi/engine';
import { RANKING_QUERY_MAX, type ModeStanding, type RankingRow, type RankingView } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { Checkbox } from '../components/ui.tsx';
import { useT } from '../i18n/index.ts';
import { session } from '../session.ts';
import { useStore } from '../store.ts';
import { CommunityNav } from './PlayersPage.tsx';

const SEARCH_DELAY_MS = 250;

/** Page numbers around the current one, with the first and the last; null marks a gap. */
const pageList = (current: number, last: number): Array<number | null> => {
  const pages: Array<number | null> = [];
  for (let page = 1; page <= last; page++) {
    if (page === 1 || page === last || Math.abs(page - current) <= 1) pages.push(page);
    else if (pages[pages.length - 1] !== null) pages.push(null);
  }
  return pages;
};

const standingText = (you: ModeStanding, provisional: string): string =>
  you.rank !== null ? `#${you.rank}` : you.provisional ? provisional : '';

const ModeLink = ({ mode, active, players, you }: { mode: Mode; active: boolean; players: number; you: ModeStanding | null }) => {
  const t = useT();
  return (
    <a class={`ligungi-ranking-mode${active ? ' active' : ''}`} href={`/ranking/${mode}`} aria-current={active ? 'page' : undefined}>
      <span class="ligungi-ranking-mode__name">{t.modes[mode]}</span>
      <span class="ligungi-ranking-mode__count">{t.ranking.inRanking(players)}</span>
      {you && (
        <span class="ligungi-ranking-mode__you">
          <span>
            {t.ranking.you}: <strong>{`${you.rating}${you.provisional ? '?' : ''}`}</strong>
          </span>
          <span class={you.rank !== null ? 'ligungi-ranking-mode__rank' : 'ligungi-ranking-mode__provisional'}>
            {standingText(you, t.ranking.provisional)}
          </span>
        </span>
      )}
    </a>
  );
};

const Row = ({ row, me }: { row: RankingRow; me: boolean }) => {
  const t = useT();
  const { wins, draws, losses } = row.record;
  return (
    <li class={`ligungi-ranking-row${me ? ' ligungi-ranking-row--me' : ''}`} id={me ? 'ranking-me' : undefined}>
      <span class={`ligungi-ranking-row__rank${row.rank <= 3 ? ` ligungi-ranking-row__rank--${row.rank}` : ''}`}>{row.rank}</span>
      <span class="ligungi-ranking-row__player">
        <a class={`user-link ${row.online ? 'online' : 'offline'}`} href={`/@/${row.user.name}`}>
          <i class="line" />
          {row.user.name}
        </a>
        {me && <span class="ligungi-tag">{t.players.you}</span>}
        {row.followed && <span class="ligungi-tag">{t.players.followed}</span>}
      </span>
      <strong class="ligungi-ranking-row__rating">{row.rating}</strong>
      <span class="ligungi-ranking-row__games">{row.games}</span>
      <span class="ligungi-ranking-row__record">
        <span class="ligungi-ranking-row__win">{wins}</span> · {draws} · <span class="ligungi-ranking-row__loss">{losses}</span>
      </span>
      {/* Phones: games and record on one line under the name. */}
      <span class="ligungi-ranking-row__meta">{t.ranking.detail(row.games, wins, draws, losses)}</span>
    </li>
  );
};

/** The full leaderboard of one mode, paged, with search, a follow filter and a shortcut to the viewer's place. */
export const RankingPage = ({ mode }: { mode?: Mode }) => {
  const t = useT();
  const { user } = useStore(session);
  const [view, setView] = useState<RankingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [onlyFollowed, setOnlyFollowed] = useState(false);
  const scrollToMe = useRef(false);
  const request = useRef(0);

  useEffect(() => {
    setPage(1);
    setInput('');
    setQuery('');
    setOnlyFollowed(false);
  }, [mode]);

  useEffect(() => {
    const next = input.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, query]);

  useEffect(() => {
    const id = ++request.current;
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (query) params.set('q', query);
    if (onlyFollowed && user) params.set('followed', '1');
    const search = params.toString() ? `?${params}` : '';
    setLoading(true);
    api
      .get<RankingView>(`/api/ranking${mode ? `/${mode}` : ''}${search}`)
      .then((next) => {
        if (id !== request.current) return;
        setView(next);
        setError(null);
      })
      .catch((err: Error) => id === request.current && setError(err.message))
      .finally(() => id === request.current && setLoading(false));
  }, [mode, page, query, onlyFollowed, user?.id]);

  useEffect(() => {
    if (!scrollToMe.current || loading) return;
    scrollToMe.current = false;
    document.getElementById('ranking-me')?.scrollIntoView({ block: 'center' });
  }, [view, loading]);

  const goToMe = () => {
    if (!view?.you) return;
    // Only a change in the request reloads the list; otherwise the viewer's row is already on screen.
    const reload = query !== '' || onlyFollowed || page !== view.you.page;
    setInput('');
    setQuery('');
    setOnlyFollowed(false);
    if (reload) {
      scrollToMe.current = true;
      setPage(view.you.page);
    } else document.getElementById('ranking-me')?.scrollIntoView({ block: 'center' });
  };

  const shown = view?.mode ?? mode;
  const last = view ? Math.max(1, Math.ceil(view.total / view.pageSize)) : 1;
  const first = view ? (view.page - 1) * view.pageSize + 1 : 0;
  const mine = shown && view ? view.modes[shown].you : null;

  return (
    <main class="ligungi-page ligungi-ranking-page">
      <CommunityNav active="ranking" />
      {error && !view && <p class="error">{error}</p>}
      {!view && !error && <p class="ligungi-notice">{t.common.loading}</p>}
      {view && shown && (
        <div class="ligungi-ranking-page__body">
          <nav class="ligungi-card ligungi-ranking-page__modes" aria-label={t.ranking.modes}>
            {MODES.map((m) => (
              <ModeLink key={m} mode={m} active={m === shown} players={view.modes[m].players} you={view.modes[m].you} />
            ))}
            <p class="ligungi-ranking-page__rule">{t.ranking.rule}</p>
          </nav>

          <section class={`ligungi-card ligungi-ranking-page__table${loading ? ' is-loading' : ''}`} aria-busy={loading}>
            <header class="ligungi-ranking-page__head">
              <h1>{t.modes[shown]}</h1>
              <span class="ligungi-ranking-page__count">{t.ranking.playerCount(view.modes[shown].players)}</span>
              {user && <Checkbox id="rk-followed" checked={onlyFollowed} label={t.players.onlyFollowed} onChange={(on) => (setOnlyFollowed(on), setPage(1))} />}
              <input
                class="form-control"
                type="search"
                maxLength={RANKING_QUERY_MAX}
                placeholder={t.players.search}
                aria-label={t.players.search}
                value={input}
                onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              />
            </header>
            {error && <p class="error ligungi-ranking-page__empty">{error}</p>}
            {view.rows.length === 0 ? (
              <p class="ligungi-notice ligungi-ranking-page__empty">{query || onlyFollowed ? t.ranking.noMatch : t.ranking.empty}</p>
            ) : (
              <ol class="ligungi-ranking-list">
                <li class="ligungi-ranking-row ligungi-ranking-row--head" aria-hidden="true">
                  <span>#</span>
                  <span>{t.ranking.player}</span>
                  <span>{t.ranking.rating}</span>
                  <span>{t.ranking.games}</span>
                  <span title={t.ranking.recordLabel}>{t.ranking.record}</span>
                </li>
                {view.rows.map((row) => (
                  <Row key={row.user.id} row={row} me={row.user.id === user?.id} />
                ))}
              </ol>
            )}
            {view.total > 0 && (
              <footer class="ligungi-ranking-page__foot">
                <span class="ligungi-ranking-page__range">{t.ranking.range(first, Math.min(view.total, first + view.rows.length - 1), view.total)}</span>
                <nav class="ligungi-ranking-pages" aria-label={t.ranking.pages}>
                  <button type="button" class="ligungi-ranking-pages__step" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
                    {t.ranking.previous}
                  </button>
                  {pageList(view.page, last).map((n, index) =>
                    n === null ? (
                      <span key={`gap${index}`} class="ligungi-ranking-pages__gap">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        class={`ligungi-ranking-pages__number${n === view.page ? ' active' : ''}`}
                        aria-current={n === view.page ? 'page' : undefined}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    ),
                  )}
                  <button type="button" class="ligungi-ranking-pages__step" disabled={view.page >= last} onClick={() => setPage(view.page + 1)}>
                    {t.ranking.next}
                  </button>
                </nav>
                {view.you && (
                  <button type="button" class="button button-empty ligungi-ranking-page__mine" onClick={goToMe}>
                    {t.ranking.myPosition}
                  </button>
                )}
              </footer>
            )}
          </section>

          {view.you && mine && (
            <button type="button" class="ligungi-ranking-you" onClick={goToMe}>
              <span class="ligungi-ranking-you__rank">#{view.you.rank}</span>
              <span class="ligungi-ranking-you__text">
                {t.ranking.you} · <strong>{mine.rating}</strong>
              </span>
              <span class="ligungi-ranking-you__link">{t.ranking.seeMine}</span>
            </button>
          )}
        </div>
      )}
    </main>
  );
};
