import { MODES, type Mode } from '@ligungi/engine';
import { STUDY_QUERY_MAX, STUDY_TOPICS, isStudyTopic, type StudyList, type StudyListItem, type StudySort, type StudyTopic } from '@ligungi/protocol';
import { Field, FieldRow, Select } from '../components/ui.tsx';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../core/api.ts';
import { NewStudyModal } from '../study/StudyForms.tsx';
import { formatDate, timeAgo, useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../core/router.ts';
import { session } from '../core/session.ts';
import { useStore } from '../core/store.ts';

/** Waits this long after the last key before searching. */
const SEARCH_DELAY_MS = 300;

/**
 * The studies: the public ones, latest changed or most liked first, and with an account the ones you like and your own
 * whatever their visibility. Cards show text only, never a board, so a drawing is seen only inside the study.
 */
export const StudiesPage = () => {
  const t = useT();
  const { search } = useLocation();
  const { user } = useStore(session);
  const params = new URLSearchParams(search);
  const mine = params.get('list') === 'mine' && user !== null;
  const liked = params.get('list') === 'liked' && user !== null;
  const sort: StudySort = !mine && !liked && params.get('sort') === 'liked' ? 'liked' : 'updated';
  // The public list narrows by the mode of the chapters, a topic and an author, all kept in the address to share.
  const pub = !mine && !liked;
  const mode = pub ? (MODES.find((m) => m === params.get('mode')) ?? null) : null;
  const topicParam = params.get('topic');
  const topic: StudyTopic | null = pub && isStudyTopic(topicParam) ? topicParam : null;
  const author = pub ? params.get('author') : null;
  /** The public list's address with one filter changed, the others kept. */
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | null> = { sort: sort === 'liked' ? 'liked' : null, mode, topic, author, ...changes };
    for (const [key, value] of Object.entries(current)) if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/study?${query}` : '/study';
  };
  const [query, setQuery] = useState('');
  const [list, setList] = useState<StudyListItem[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(params.has('new'));

  const load = (pageToLoad: number, append: boolean) => {
    const q = new URLSearchParams({
      q: query.trim(),
      page: String(pageToLoad),
      ...(mine ? { list: 'mine' } : liked ? { list: 'liked' } : sort === 'liked' ? { sort } : {}),
      ...(mode ? { mode } : {}),
      ...(topic ? { topic } : {}),
      ...(author ? { author } : {}),
    });
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
  }, [query, mine, liked, sort, mode, topic, author]);

  return (
    <main class="ligungi-page ligungi-studies">
      <section class="ligungi-card ligungi-studies__panel">
        <div class="ligungi-studies__bar">
          <h1>{t.study.title}</h1>
          {user && (
            <nav class="ligungi-segmented ligungi-studies__tabs" aria-label={t.study.title}>
              <a href="/study" aria-current={mine || liked ? undefined : 'page'} class={mine || liked ? '' : 'active'}>
                {t.study.publicTab}
              </a>
              <a href="/study?list=liked" aria-current={liked ? 'page' : undefined} class={liked ? 'active' : ''}>
                {t.study.likedTab}
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
        {pub && (
          <div class="ligungi-studies__filters">
            <nav class="ligungi-segmented ligungi-studies__sort" aria-label={t.study.sort}>
              <a href={hrefWith({ sort: null })} aria-current={sort === 'updated' ? 'page' : undefined} class={sort === 'updated' ? 'active' : ''}>
                {t.study.sortUpdated}
              </a>
              <a href={hrefWith({ sort: 'liked' })} aria-current={sort === 'liked' ? 'page' : undefined} class={sort === 'liked' ? 'active' : ''}>
                {t.study.sortLiked}
              </a>
            </nav>
            <FieldRow>
              <Field label={t.study.filterMode} htmlFor="studies-mode">
                <Select<Mode | ''>
                  id="studies-mode"
                  value={mode ?? ''}
                  options={[{ value: '', label: t.study.allModes }, ...MODES.map((m) => ({ value: m, label: t.modes[m] }))]}
                  onChange={(value) => navigate(hrefWith({ mode: value || null }), true)}
                />
              </Field>
              <Field label={t.study.filterTopic} htmlFor="studies-topic">
                <Select<StudyTopic | ''>
                  id="studies-topic"
                  value={topic ?? ''}
                  options={[{ value: '', label: t.study.allTopics }, ...STUDY_TOPICS.map((value) => ({ value, label: t.study.topicNames[value] }))]}
                  onChange={(value) => navigate(hrefWith({ topic: value || null }), true)}
                />
              </Field>
            </FieldRow>
            {author && (
              <p class="ligungi-studies__author">
                <strong>{t.study.byAuthor(author)}</strong> <a href={hrefWith({ author: null })}>{t.study.showEveryAuthor}</a>
              </p>
            )}
          </div>
        )}
        {error && <p class="ligungi-error">{error}</p>}
        {list && list.length === 0 && <p class="ligungi-empty">{query ? t.study.noMatch : mine ? t.study.noneMine : liked ? t.study.noneLiked : t.study.none}</p>}
        {list && list.length > 0 && (
          <ul class="ligungi-studies__list">
            {list.map((study) => (
              <li key={study.id}>
                <a class="ligungi-studies__card" href={`/study/${study.id}`}>
                  <strong class="ligungi-studies__name">{study.title}</strong>
                  {study.description && <span class="ligungi-studies__description">{study.description}</span>}
                  {(study.topics.length > 0 || study.modes.length > 0) && (
                    <span class="ligungi-studies__tags">
                      {study.topics.map((value) => (
                        <span key={value} class="ligungi-studies__tag">
                          {t.study.topicNames[value]}
                        </span>
                      ))}
                      {study.modes.map((value) => (
                        <span key={value} class="ligungi-studies__tag ligungi-studies__tag--mode">
                          {t.modes[value]}
                        </span>
                      ))}
                    </span>
                  )}
                  <span class="ligungi-studies__meta">
                    <span>{t.study.chapterCount(study.chapters)}</span>
                    {study.likes > 0 && (
                      <span class="ligungi-studies__likes" data-icon={icons.Heart}>
                        {t.study.likeCount(study.likes)}
                      </span>
                    )}
                    {!mine && <span>{t.study.by(study.owner.name)}</span>}
                    {mine && <span>{t.study.visibilities[study.visibility]}</span>}
                    {mine && study.listedFrom !== null && <span>{t.study.listedFromShort(formatDate(t, study.listedFrom))}</span>}
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
            if (new URLSearchParams(search).has('new')) navigate(mine ? '/study?list=mine' : liked ? '/study?list=liked' : '/study', true);
          }}
        />
      )}
    </main>
  );
};
