import { MODES } from '@ligungi/engine';
import { GAME_REASONS, GAME_SEARCH_PAGES_MAX, type GameSearchResult, type GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { Field, Select, SubmitButton } from '../components/ui.tsx';
import { formatDate, playerName, speedText, useT } from '../i18n/index.ts';
import { navigate, useLocation } from '../router.ts';

const FIELDS = ['player', 'color', 'vs', 'mode', 'rated', 'result', 'reason', 'ratingMin', 'ratingMax', 'from', 'to', 'movesMin', 'movesMax'] as const;
type Form = Record<(typeof FIELDS)[number], string>;

const formFrom = (search: string): Form => {
  const params = new URLSearchParams(search);
  return Object.fromEntries(FIELDS.map((field) => [field, params.get(field) ?? ''])) as Form;
};

/** The fields that only make sense with a player (its color, opponent, own result) are dropped without one. */
const queryOf = (form: Form, page = 1): string => {
  const params = new URLSearchParams();
  const withPlayer = form.player.trim() !== '';
  for (const field of FIELDS) {
    const value = form[field].trim();
    if (!value) continue;
    if (!withPlayer && (field === 'color' || field === 'vs' || (field === 'result' && (value === 'win' || value === 'loss')))) continue;
    params.set(field, value);
  }
  if (page > 1) params.set('page', String(page));
  return params.toString();
};

/** The filters beyond player, opponent, mode and result, folded under "More filters" unless one is set. */
const ADVANCED: ReadonlyArray<keyof Form> = ['color', 'rated', 'reason', 'ratingMin', 'ratingMax', 'movesMin', 'movesMax', 'from', 'to'];

const pageFrom = (search: string): number => Math.min(GAME_SEARCH_PAGES_MAX, Math.max(1, Math.floor(Number(new URLSearchParams(search).get('page'))) || 1));

/** One game of the results, as a row of a table: players, result, mode and pace, moves and date. */
const ResultRow = ({ game }: { game: GameSummary }) => {
  const t = useT();
  const side = (color: 'white' | 'black') => {
    const player = game.players[color];
    return `${playerName(t, player)}${player.rating !== null ? ` (${player.rating})` : ''}`;
  };
  const winner = game.outcome?.winner;
  const result = winner ? t.gameSearch.results[winner] : t.gameSearch.results.draw;
  const how = [...(game.outcome ? [t.reasons[game.outcome.reason]] : []), ...(game.voided ? [t.profile.voided] : [])].join(' · ');
  return (
    <li>
      <a class="ligungi-search-table__row" href={`/${game.id}`}>
        <span class="ligungi-search-table__players">{t.gameSearch.versus(side('white'), side('black'))}</span>
        <span class="ligungi-search-table__result">
          {result}
          {how && <small>{how}</small>}
        </span>
        <span class="ligungi-search-table__mode">{[t.modes[game.mode], speedText(t, game), game.rated ? t.rated : t.casual].join(' · ')}</span>
        <span class="ligungi-search-table__moves">
          <span class="ligungi-sr-only">{t.gameSearch.columns.moves}: </span>
          {game.plies}
        </span>
        <span class="ligungi-search-table__date">{formatDate(t, game.createdAt)}</span>
      </a>
    </li>
  );
};

/** Search over every finished game, with the filters and the page kept in the address so a search can be shared. */
export const GameSearchPage = () => {
  const t = useT();
  const s = t.gameSearch;
  const { search } = useLocation();
  const [form, setForm] = useState<Form>(() => formFrom(search));
  const [open, setOpen] = useState(() => ADVANCED.some((field) => formFrom(search)[field] !== ''));
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = pageFrom(search);

  useEffect(() => {
    const current = formFrom(search);
    setForm(current);
    setGames(null);
    api
      .get<GameSearchResult>(`/api/games/search?${queryOf(current, page)}`)
      .then((result) => {
        setGames([...result.games]);
        setMore(result.more);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [search]);

  const set = (field: keyof Form) => (value: string) => setForm((previous) => ({ ...previous, [field]: value }));
  const text = (field: keyof Form, type: 'text' | 'number' | 'date' = 'text', limits: { min?: number; max?: number; step?: number } = {}) => {
    const common = {
      id: `search-${field}`,
      class: 'form-control',
      autoComplete: 'off',
      value: form[field],
      onInput: (event: Event) => set(field)((event.target as HTMLInputElement).value),
    };
    // Written out per type: the input's attributes depend on its type, which a variable does not narrow.
    if (type === 'number') return <input type="number" {...common} {...limits} />;
    if (type === 'date') return <input type="date" {...common} />;
    return <input type="text" maxLength={20} {...common} />;
  };
  const any = { value: '', label: s.any };
  const withPlayer = form.player.trim() !== '';
  const pageHref = (target: number) => {
    const query = queryOf(formFrom(search), target);
    return `/games${query ? `?${query}` : ''}`;
  };

  return (
    <main class="ligungi-page ligungi-game-search">
      <section class="ligungi-card ligungi-game-search__panel">
        <h1>{s.title}</h1>
        <p class="ligungi-game-search__intro">{s.intro}</p>
        <form
          class="form3 ligungi-game-search__form"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/games${queryOf(form) ? `?${queryOf(form)}` : ''}`);
          }}
        >
          <div class="ligungi-game-search__main">
            <Field label={s.player} htmlFor="search-player">
              {text('player')}
            </Field>
            <Field label={s.vs} htmlFor="search-vs" help={s.vsHelp}>
              {text('vs')}
            </Field>
            <Field label={t.common.mode} htmlFor="search-mode">
              <Select id="search-mode" value={form.mode} options={[any, ...MODES.map((mode) => ({ value: mode, label: t.modes[mode] }))]} onChange={set('mode')} />
            </Field>
            <Field label={s.result} htmlFor="search-result">
              <Select
                id="search-result"
                value={form.result}
                options={[
                  any,
                  ...(['white', 'black', 'draw'] as const).map((value) => ({ value, label: s.results[value] })),
                  ...(withPlayer ? (['win', 'loss'] as const).map((value) => ({ value, label: s.results[value] })) : []),
                ]}
                onChange={set('result')}
              />
            </Field>
          </div>
          {open && (
            <div id="search-more" class="ligungi-game-search__more">
              <Field label={s.color} htmlFor="search-color" help={s.colorHelp}>
                <Select id="search-color" value={withPlayer ? form.color : ''} options={[any, { value: 'white', label: t.colors.white }, { value: 'black', label: t.colors.black }]} onChange={set('color')} />
              </Field>
              <Field label={s.kind} htmlFor="search-rated">
                <Select id="search-rated" value={form.rated} options={[any, { value: '1', label: t.rated }, { value: '0', label: t.casual }]} onChange={set('rated')} />
              </Field>
              <Field label={s.reason} htmlFor="search-reason">
                <Select id="search-reason" value={form.reason} options={[any, ...GAME_REASONS.map((value) => ({ value, label: t.reasons[value] }))]} onChange={set('reason')} />
              </Field>
              <Field label={`${s.rating}: ${s.min}`} htmlFor="search-ratingMin" help={s.ratingHelp}>
                {text('ratingMin', 'number', { min: 0, max: 4000, step: 50 })}
              </Field>
              <Field label={`${s.rating}: ${s.max}`} htmlFor="search-ratingMax">
                {text('ratingMax', 'number', { min: 0, max: 4000, step: 50 })}
              </Field>
              <Field label={`${s.moves}: ${s.min}`} htmlFor="search-movesMin" help={s.movesHelp}>
                {text('movesMin', 'number', { min: 0, max: 2000 })}
              </Field>
              <Field label={`${s.moves}: ${s.max}`} htmlFor="search-movesMax">
                {text('movesMax', 'number', { min: 0, max: 2000 })}
              </Field>
              <Field label={s.from} htmlFor="search-from" help={s.datesHelp}>
                {text('from', 'date')}
              </Field>
              <Field label={s.to} htmlFor="search-to">
                {text('to', 'date')}
              </Field>
            </div>
          )}
          <div class="ligungi-game-search__actions">
            <SubmitButton>{s.search}</SubmitButton>
            <a class="button button-empty" href="/games">
              {s.clear}
            </a>
            <button type="button" class="button button-empty ligungi-game-search__toggle" aria-expanded={open} aria-controls="search-more" onClick={() => setOpen(!open)}>
              {open ? s.fewerFilters : s.moreFilters}
            </button>
          </div>
        </form>
      </section>
      <section class="ligungi-card ligungi-game-search__results" aria-label={s.resultsLabel}>
        {error && <p class="error">{error}</p>}
        {!error && games === null && <p class="ligungi-notice">{t.common.loading}</p>}
        {games?.length === 0 && <p class="ligungi-notice">{s.none}</p>}
        {games && games.length > 0 && (
          <>
            <div class="ligungi-search-table__head" aria-hidden="true">
              <span>{s.columns.players}</span>
              <span>{s.columns.result}</span>
              <span>{s.columns.mode}</span>
              <span class="ligungi-search-table__moves">{s.columns.moves}</span>
              <span class="ligungi-search-table__date">{s.columns.date}</span>
            </div>
            <ul class="ligungi-search-table">
              {games.map((game) => (
                <ResultRow key={game.id} game={game} />
              ))}
            </ul>
          </>
        )}
        {(page > 1 || more) && (
          <nav class="ligungi-game-search__pager" aria-label={s.pages}>
            {page > 1 ? <a href={pageHref(page - 1)}>{s.previous}</a> : <span />}
            <span aria-current="page">{s.page(page)}</span>
            {more && page < GAME_SEARCH_PAGES_MAX ? <a href={pageHref(page + 1)}>{s.next}</a> : <span />}
          </nav>
        )}
      </section>
    </main>
  );
};
