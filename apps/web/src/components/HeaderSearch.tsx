import type { UserSearchResult } from '@ligungi/protocol';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { useT } from '../i18n/index.ts';
import { icons } from '../icons.ts';
import { navigate, useLocation } from '../router.ts';

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 150;

export const HeaderSearch = () => {
  const t = useT();
  const { path } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[] | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [path]);

  useEffect(() => {
    document.body.classList.toggle('clinput', open);
    if (!open) {
      if (document.activeElement === input.current) input.current?.blur();
      return;
    }
    const close = (event: MouseEvent) => {
      if (box.current && !event.composedPath().includes(box.current)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_LENGTH) {
      setResults(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get<UserSearchResult[]>(`/api/users?q=${encodeURIComponent(term)}`)
        .then((list) => {
          if (!alive) return;
          setResults(list);
          setActive(0);
        })
        .catch(() => alive && setResults([]));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const go = (name: string) => navigate(`/@/${name}`);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false);
    if (!results?.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[active]!.user.name);
    }
  };

  return (
    <div id="clinput" class="ligungi-search" role="search" ref={box}>
      <button
        type="button"
        class="link"
        title={t.search.label}
        aria-label={t.search.label}
        aria-expanded={open}
        data-icon={icons.Search}
        onClick={() => (open ? setOpen(false) : input.current?.focus())}
      />
      <input
        ref={input}
        type="search"
        spellcheck={false}
        autoComplete="off"
        placeholder={t.search.placeholder}
        aria-label={t.search.label}
        tabIndex={open ? 0 : -1}
        maxLength={20}
        value={query}
        onFocus={() => setOpen(true)}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onKeyDown={onKey}
      />
      {open && results && (
        <ul class="ligungi-search__results" role="listbox">
          {results.length === 0 && <li class="ligungi-search__empty">{t.search.noResults}</li>}
          {results.map((result, index) => (
            <li key={result.user.id} role="option" aria-selected={index === active}>
              <a
                class={`user-link ${result.online ? 'online' : 'offline'}${index === active ? ' active' : ''}`}
                href={`/@/${result.user.name}`}
                onMouseEnter={() => setActive(index)}
              >
                <i class="line" />
                {result.user.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
