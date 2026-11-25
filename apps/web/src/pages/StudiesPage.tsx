import { STUDY_QUERY_MAX, type StudyList, type StudyListItem } from '@ligungi/protocol';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { NewStudyModal } from '../study/StudyForms.tsx';
import { timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../core/router.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';

/** Waits this long after the last key before searching. */
const SEARCH_DELAY_MS = 300;

/**
 * The studies: the public ones, latest changed first, and with an account your own whatever their visibility. Cards
 * show text only, never a board, so a drawing is seen only inside the study.
 */
export const StudiesPage = () => {
  const t = useT();
  const { search } = useLocation();
  const { user } = useStore(session);
  const params = new URLSearchParams(search);
  const mine = params.get('list') === 'mine' && user !== null;
  const [query, setQuery] = useState('');
  const [list, setList] = useState<StudyListItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(params.has('new'));

  const load = (pageToLoad: number, append: boolean) => {
    const q = new URLSearchParams({ q: query.trim(), page: String(pageToLoad), ...(mine ? { list: 'mine' } : {}) });
    api
      .get<StudyList>(`/api/studies?${q.toString()}`)
      .then((result) => {
        setList((previous) => (append && previous ? [...previous, ...result.studies] : [...result.studies]));
        setMore(result.more);
        setPage(pageToLoad);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(1, false), query ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query, mine]);

  return (
    <main class="ligungi-page ligungi-studies">
      <section class="ligungi-card ligungi-studies__panel">
        <div class="ligungi-studies__bar">
          <h1>{t.study.title}</h1>
          {user && (
            <nav class="ligungi-segmented ligungi-studies__tabs" aria-label={t.study.title}>
              <a href="/study" aria-current={mine ? undefined : 'page'} class={mine ? '' : 'active'}>
                {t.study.publicTab}
              </a>
              <a href="/study?list=mine" aria-current={mine ? 'page' : undefined} class={mine ? 'active' : ''}>
                {t.study.mineTab}
              </a>
            </nav>
          )}
          <input
            type="search"
            class="form-control ligungi-studies__search"
            aria-label={t.study.search}
            placeholder={t.study.search}
            maxLength={STUDY_QUERY_MAX}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          {user ? (
            <button type="button" class="button text" data-icon={icons.PlusButton} onClick={() => setCreating(true)}>
              {t.study.newStudy}
            </button>
          ) : (
            <a class="button button-empty" href="/login">
              {t.study.signInToCreate}
            </a>
          )}
        </div>
        <p class="ligungi-studies__intro">{t.study.intro}</p>
        {error && <p class="ligungi-error">{error}</p>}
        {list && list.length === 0 && <p class="ligungi-empty">{query ? t.study.noMatch : mine ? t.study.noneMine : t.study.none}</p>}
        {list && list.length > 0 && (
          <ul class="ligungi-studies__list">
            {list.map((study) => (
              <li key={study.id}>
                <a class="ligungi-studies__card" href={`/study/${study.id}`}>
                  <strong class="ligungi-studies__name">{study.title}</strong>
                  {study.description && <span class="ligungi-studies__description">{study.description}</span>}
                  <span class="ligungi-studies__meta">
                    <span>{t.study.chapterCount(study.chapters)}</span>
                    {!mine && <span>{t.study.by(study.owner.name)}</span>}
                    {mine && <span>{t.study.visibilities[study.visibility]}</span>}
                    {study.hidden && <span class="ligungi-studies__hidden">{t.study.hiddenTag}</span>}
                    <span>{timeAgo(t, study.updatedAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {more && (
          <div class="ligungi-actions">
            <button type="button" class="button button-empty" onClick={() => load(page + 1, true)}>
              {t.study.more}
            </button>
          </div>
        )}
      </section>
      {creating && (
        <NewStudyModal
          onClose={() => {
            setCreating(false);
            if (new URLSearchParams(search).has('new')) navigate(mine ? '/study?list=mine' : '/study', true);
          }}
        />
      )}
    </main>
  );
};
