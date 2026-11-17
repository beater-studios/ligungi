import { MODES } from '@ligungi/engine';
import { GAME_REASONS, type GameSearchResult, type GameSummary } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { Field, FieldRow, Select, SubmitButton } from '../components/ui.tsx';
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

/** One game of the results: both players with their ratings, the result and how it went. */
const ResultRow = ({ game }: { game: GameSummary }) => {
  const t = useT();
  const side = (color: 'white' | 'black') => {
    const player = game.players[color];
    return `${playerName(t, player)}${player.rating !== null ? ` (${player.rating})` : ''}`;
  };
  const winner = game.outcome?.winner;
  const result = winner ? t.gameSearch.results[winner] : t.gameSearch.results.draw;
  const meta = [
    t.modes[game.mode],
    speedText(t, game),
    game.rated ? t.rated : t.casual,
    ...(game.outcome ? [`${t.reasons[game.outcome.reason]} · ${t.profile.moves(game.plies)}`] : []),
    ...(game.voided ? [t.profile.voided] : []),
  ].join(' · ');
  return (
    <li>
      <a class="ligungi-game-row ligungi-game-search__row" href={`/${game.id}`}>
        <span class="ligungi-game-row__result">{result}</span>
        <span class="ligungi-game-row__main">
          <span class="ligungi-game-row__opponent">{t.gameSearch.versus(side('white'), side('black'))}</span>
          <span class="ligungi-game-row__meta">{meta}</span>
        </span>
        <span class="ligungi-game-row__date">{formatDate(t, game.createdAt)}</span>
      </a>
    </li>
  );
};

/** Search over every finished game, with the filters kept in the address so a search can be shared. */
export const GameSearchPage = () => {
  const t = useT();
  const s = t.gameSearch;
  const { search } = useLocation();
  const [form, setForm] = useState<Form>(() => formFrom(search));
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = (query: string, pageToLoad: number, append: boolean) => {
    api
      .get<GameSearchResult>(`/api/games/search?${query}${pageToLoad > 1 ? `&page=${pageToLoad}` : ''}`)
      .then((result) => {
        setGames((previous) => (append && previous ? [...previous, ...result.games] : [...result.games]));
        setMore(result.more);
        setPage(pageToLoad);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    const current = formFrom(search);
    setForm(current);
    load(queryOf(current), 1, false);
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
          <FieldRow>
            <Field label={s.player} htmlFor="search-player" help={s.playerHelp}>
              {text('player')}
            </Field>
            <Field label={s.color} htmlFor="search-color">
              <Select id="search-color" value={withPlayer ? form.color : ''} options={[any, { value: 'white', label: t.colors.white }, { value: 'black', label: t.colors.black }]} onChange={set('color')} />
            </Field>
            <Field label={s.vs} htmlFor="search-vs" help={s.vsHelp}>
              {text('vs')}
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label={t.common.mode} htmlFor="search-mode">
              <Select id="search-mode" value={form.mode} options={[any, ...MODES.map((mode) => ({ value: mode, label: t.modes[mode] }))]} onChange={set('mode')} />
            </Field>
            <Field label={s.kind} htmlFor="search-rated">
              <Select id="search-rated" value={form.rated} options={[any, { value: '1', label: t.rated }, { value: '0', label: t.casual }]} onChange={set('rated')} />
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
            <Field label={s.reason} htmlFor="search-reason">
              <Select id="search-reason" value={form.reason} options={[any, ...GAME_REASONS.map((value) => ({ value, label: t.reasons[value] }))]} onChange={set('reason')} />
            </Field>
          </FieldRow>
          <FieldRow>
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
          </FieldRow>
          <FieldRow>
            <Field label={s.from} htmlFor="search-from" help={s.datesHelp}>
              {text('from', 'date')}
            </Field>
            <Field label={s.to} htmlFor="search-to">
              {text('to', 'date')}
            </Field>
          </FieldRow>
          <div class="ligungi-game-search__actions">
            <SubmitButton>{s.search}</SubmitButton>
            <a class="button button-empty" href="/games">
              {s.clear}
            </a>
          </div>
        </form>
      </section>
      <section class="ligungi-card ligungi-game-search__results">
        {error && <p class="error">{error}</p>}
        {!error && games === null && <p class="ligungi-notice">{t.common.loading}</p>}
        {games?.length === 0 && <p class="ligungi-notice">{s.none}</p>}
        {games && games.length > 0 && (
          <ul class="ligungi-game-list">
            {games.map((game) => (
              <ResultRow key={game.id} game={game} />
            ))}
          </ul>
        )}
        {more && (
          <div class="ligungi-actions">
            <button type="button" class="button button-empty" onClick={() => load(queryOf(formFrom(search)), page + 1, true)}>
              {s.more}
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
