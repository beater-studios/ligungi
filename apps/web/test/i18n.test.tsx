import { ROLES } from '@ligungi/engine';
import { ERROR_CODES } from '@ligungi/protocol';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { languages, MIN_COVERAGE, offeredLanguages } from '../scripts/languages.ts';
import { faqItems, Markdown, markdownProblems } from '../src/i18n/content/markdown.tsx';
import { LEGAL_UPDATED, LONG_PAGES, usablePage } from '../src/i18n/content/pages.ts';
import { argumentsOf, checkMessage, formatParts, formatText, IcuError, tagsOf } from '../src/i18n/icu.ts';
import { LANGS, matchLang } from '../src/i18n/languages.ts';
import { buildMessages, ENGLISH, loadAllLanguages, messagesFor, usable, type Json } from '../src/i18n/messages.ts';
import { SCHEMA, type Spec } from '../src/i18n/schema.tsx';

const DIR = fileURLToPath(new URL('../src/i18n/locales', import.meta.url));
const read = (file: string): Json => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Json;
const english = read('en.json');
const SPECS: Readonly<Record<string, Spec>> = SCHEMA;

const leaves = (json: Json, prefix = ''): Array<[string, unknown]> =>
  Object.entries(json).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? leaves(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value] as [string, unknown]],
  );

describe('ICU messages', () => {
  it('fills arguments, plurals and selects', () => {
    expect(formatText('Hi {name}', { name: 'Ana' }, 'en')).toBe('Hi Ana');
    expect(formatText('{n, plural, one {# day} other {# days}}', { n: 1 }, 'en')).toBe('1 day');
    expect(formatText('{n, plural, one {# day} other {# days}}', { n: 3 }, 'en')).toBe('3 days');
    expect(formatText('{n, plural, =0 {none} one {# day} other {# days}}', { n: 0 }, 'en')).toBe('none');
    // Portuguese counts 0 as one; Spanish does not.
    expect(formatText('{n, plural, one {# dia} other {# dias}}', { n: 0 }, 'pt-BR')).toBe('0 dia');
    expect(formatText('{n, plural, one {# día} other {# días}}', { n: 0 }, 'es')).toBe('0 días');
    expect(formatText('{c, select, white {White} other {Black}}', { c: 'black' }, 'en')).toBe('Black');
    expect(formatText('{x, select, none {no} other {yes}}', { x: null }, 'en')).toBe('no');
    expect(formatText('{b, select, true {on} other {off}}', { b: true }, 'en')).toBe('on');
    expect(formatText('{a, plural, other {# and {b, plural, one {# one} other {# more}}}}', { a: 2, b: 1 }, 'en')).toBe('2 and 1 one');
  });

  it('reads apostrophes and literal braces as ICU does', () => {
    expect(formatText("the opponent's turn", {}, 'en')).toBe("the opponent's turn");
    expect(formatText("It''s '{'literal'}'", {}, 'en')).toBe("It's {literal}");
    expect(formatText("Puzzle #{id} · {n, plural, other {# tries, '#'1}}", { id: 7, n: 2 }, 'en')).toBe('Puzzle #7 · 2 tries, #1');
  });

  it('turns tags into markup and leaves unknown tags as text', () => {
    const parts = formatParts('Go <b>now</b>, <i>{n}</i>', { n: 3 }, 'en', { b: (children) => `[${children.join('')}]` });
    expect(parts.join('')).toBe('Go [now], 3');
  });

  it('refuses broken messages', () => {
    for (const broken of ['{n, plural, one {x}}', '{n, number}', 'open {name', '<b>bold', "it'{s"]) expect(() => checkMessage(broken), broken).toThrow(IcuError);
  });
});

describe('locale files', () => {
  it('describe in schema.tsx exactly the English messages that take arguments, tags or lines', () => {
    const keys = new Map(leaves(english));
    for (const [path, spec] of Object.entries(SPECS)) {
      const text = keys.get(path);
      expect(typeof text, path).toBe('string');
      if (spec.kind === 'text' || spec.kind === 'rich') expect(argumentsOf(text as string).sort(), path).toEqual([...spec.names].sort());
      if (spec.kind === 'rich') for (const tag of tagsOf(text as string)) expect(spec.tags[tag], `${path} <${tag}>`).toBeDefined();
    }
    for (const [path, text] of keys) {
      expect(typeof text, path).toBe('string');
      expect(() => checkMessage(text as string), path).not.toThrow();
      if (!SPECS[path]) expect([argumentsOf(text as string), tagsOf(text as string)], path).toEqual([[], []]);
    }
  });

  it('only translate English keys, with valid messages', () => {
    const keys = new Map(leaves(english));
    for (const file of readdirSync(DIR).filter((name) => name.endsWith('.json') && name !== 'en.json')) {
      for (const [path, text] of leaves(read(file))) {
        expect(keys.has(path), `${file} ${path}`).toBe(true);
        if (text !== '') expect(usable(path, text, keys.get(path) as string), `${file} ${path}: ${String(text)}`).toBe(true);
      }
    }
  });

  it('have an English message for every server error', () => {
    for (const code of ERROR_CODES) expect(ENGLISH.errors[code], code).toBeTruthy();
  });

  it('name the pieces apart in every language', async () => {
    await loadAllLanguages();
    for (const lang of LANGS) {
      const { names, letters } = messagesFor(lang).pieces;
      expect(new Set(ROLES.map((role) => names[role].toLowerCase())).size, lang).toBe(ROLES.length);
      expect(new Set(ROLES.map((role) => letters[role])).size, lang).toBe(ROLES.length);
    }
  });
});

describe('languages', () => {
  it('offers the languages translated enough, by their own names', () => {
    expect(MIN_COVERAGE).toBe(0.8);
    for (const language of languages(DIR)) expect(language.coverage, language.code).toBeGreaterThanOrEqual(language.code === 'en' ? 1 : 0);
    expect(offeredLanguages(DIR).map(({ code, name }) => [code, name])).toEqual([
      ['en', 'English'],
      ['es', 'Español'],
      ['pt', 'Português'],
    ]);
    expect(LANGS).toEqual(['en', 'es', 'pt']);
  });

  it('matches browser languages to the offered ones', () => {
    expect(matchLang('pt-BR')).toBe('pt');
    expect(matchLang('pt-PT')).toBe('pt');
    expect(matchLang('es-419')).toBe('es');
    expect(matchLang('EN-gb')).toBe('en');
    expect(matchLang('de')).toBeUndefined();
  });

  it('falls back to English for each message a translation is missing or got wrong', () => {
    const t = buildMessages('pt', {
      aborted: 'Partida abortada',
      daysPerMove: '{n, plural, one {# dia} other {# dias}} por lance',
      days: '{count} dias',
      ongoing: '',
      noClock: 'Sem {relógio',
      pieces: { letters: { marshal: 'Ge' } },
    } as Json);
    expect(t.aborted).toBe('Partida abortada');
    expect(t.daysPerMove(2)).toBe('2 dias por lance');
    expect(t.days(2)).toBe(ENGLISH.days(2));
    expect(t.ongoing).toBe(ENGLISH.ongoing);
    expect(t.noClock).toBe(ENGLISH.noClock);
    // Two pieces with the same letters: the whole set stays in English.
    expect(t.pieces.letters).toEqual(ENGLISH.pieces.letters);
  });

  it('renders rich messages with their markup', async () => {
    await loadAllLanguages();
    expect(renderToString(<>{messagesFor('pt').challenge.ratedLogin}</>)).toBe(
      'Esta partida é ranqueada. <a href="/login">Entre</a> ou <a href="/signup">crie uma conta</a> para aceitar.',
    );
    expect(renderToString(<>{ENGLISH.friends.summary(1, 2)}</>)).toBe('You follow <strong>1</strong> player · <strong class="ligungi-friends-page__online">2 online</strong>');
    expect(renderToString(<>{ENGLISH.study.by(<b>Ana</b>)}</>)).toBe('by <b>Ana</b>');
  });
});

describe('long pages', () => {
  const CONTENT = fileURLToPath(new URL('../src/i18n/content', import.meta.url));
  const html = (source: string) => renderToString(<Markdown source={source} sources={<p>S</p>} />);

  it('renders the Markdown subset', () => {
    expect(html('## Title\n\nSome **bold** and [a page](/learn).\n\n- one\n- [two](lila)\n\n1. first\n2. second\n\n{sources}\n\nWrite to {email}.')).toBe(
      '<h2>Title</h2><p>Some <b>bold</b> and <a href="/learn">a page</a>.</p><ul><li>one</li><li><a href="https://github.com/lichess-org/lila" target="_blank" rel="noopener noreferrer">two</a></li></ul><ol><li>first</li><li>second</li></ol><p>S</p><p>Write to <a href="mailto:contato@ligungi.org">contato@ligungi.org</a>.</p>',
    );
    expect(faqItems('## Q1?\n\nA1.\n\n## Q2?\n\nA2.\n\n- x')).toEqual([
      { q: 'Q1?', a: 'A1.' },
      { q: 'Q2?', a: 'A2.\n\n- x' },
    ]);
  });

  it('never links where the code does not', () => {
    expect(html('[bad](https://evil.example) and [worse](javascript:alert(1)) <script>x</script>')).toBe(
      '<p>bad and worse) &lt;script>x&lt;/script></p>',
    );
    expect(markdownProblems('[bad](https://evil.example) {name} **open')).toHaveLength(3);
    expect(usablePage('contact', 'Write to us.')).toBe(false);
    expect(usablePage('contact', 'Write to {email}.')).toBe(true);
  });

  it('are usable in every language that has them', () => {
    for (const lang of readdirSync(CONTENT, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      for (const page of LONG_PAGES) {
        const file = `${CONTENT}/${lang}/${page}.md`;
        let source: string;
        try {
          source = readFileSync(file, 'utf8');
        } catch {
          expect(lang, `${page} is missing in English`).not.toBe('en');
          continue;
        }
        expect(markdownProblems(source), `${lang}/${page}`).toEqual([]);
        expect(usablePage(page, source), `${lang}/${page}`).toBe(true);
        if (page === 'faq') expect(faqItems(source).length, lang).toBeGreaterThan(0);
      }
    }
  });

  it('dates the legal pages in each language', async () => {
    await loadAllLanguages();
    const date = (lang: string) => {
      const t = messagesFor(lang);
      return t.info.updated(new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
    };
    expect(date('en')).toBe('Last updated: November 27, 2026.');
    expect(date('pt')).toBe('Última atualização: 27 de novembro de 2026.');
    expect(date('es')).toBe('Última actualización: 27 de noviembre de 2026.');
  });
});
