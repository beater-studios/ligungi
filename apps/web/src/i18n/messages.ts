import { JAPANESE_PIECE_NAMES, type PieceNames } from '@ligungi/board';
import { ROLES } from '@ligungi/engine';
import { createElement, Fragment, type ComponentChildren } from 'preact';
import { argumentsOf, checkMessage, formatParts, formatText, tagsOf, type Args } from './icu.ts';
import { createStore } from '../store.ts';
import { isLang, LANGS, languageName, localeOf, type Lang } from './languages.ts';
import source from './locales/en.json';
import { SCHEMA, type ListSpec, type RichSpec, type Spec, type TextSpec } from './schema.tsx';

type Schema = typeof SCHEMA;
type Value<S> =
  S extends TextSpec<infer A>
    ? (...args: A) => string
    : S extends RichSpec<infer A>
      ? A extends readonly []
        ? ComponentChildren
        : (...args: A) => ComponentChildren
      : S extends ListSpec
        ? readonly string[]
        : never;
type Tree<T, P extends string> = {
  readonly [K in keyof T & string]: T[K] extends string ? (`${P}${K}` extends keyof Schema ? Value<Schema[`${P}${K}`]> : string) : Tree<T[K], `${P}${K}.`>;
};

/** Every message of the site in one language, shaped like locales/en.json, with the arguments in schema.tsx. */
export type Messages = Tree<typeof source, ''> & {
  /** The language code (locale file name). */
  readonly lang: Lang;
  /** Its BCP 47 tag, for `Intl`. */
  readonly locale: string;
  readonly languageName: string;
};

export type Json = { readonly [key: string]: string | Json };

const SPECS: Readonly<Record<string, Spec | undefined>> = SCHEMA;

const sameItems = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item) => b.includes(item));

/** A translation is used only when it is valid ICU, uses the English text's arguments and tags, and keeps list lengths. */
export const usable = (path: string, translation: unknown, english: string): translation is string => {
  if (typeof translation !== 'string' || translation.trim() === '') return false;
  try {
    checkMessage(translation);
    const allowed = SPECS[path] && 'names' in SPECS[path] ? SPECS[path].names : [];
    if (!argumentsOf(translation).every((name) => allowed.includes(name))) return false;
    if (!tagsOf(translation).every((tag) => tagsOf(english).includes(tag))) return false;
  } catch {
    return false;
  }
  if (SPECS[path]?.kind === 'lines') return translation.split('\n').length === english.split('\n').length;
  return true;
};

const zip = (names: readonly string[], values: readonly unknown[]): Args => Object.fromEntries(names.map((name, i) => [name, values[i]]));

const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/** What the code reads for one key: the text, a function of the arguments, markup or a list. */
const valueOf = (spec: Spec | undefined, message: string, locale: string): unknown => {
  if (!spec) return formatText(message, {}, locale);
  if (spec.kind === 'lines') return message.split('\n').map((line) => formatText(line, {}, locale));
  if (spec.kind === 'words') return message.split('\n').map((word) => word.trim()).filter(Boolean);
  if (spec.kind === 'text') {
    return (...values: unknown[]) => {
      const text = formatText(message, zip(spec.names, values), locale);
      return spec.sentence ? capitalize(text, locale) : text;
    };
  }
  const markup = (values: readonly unknown[]) => createElement(Fragment, null, ...(formatParts(message, zip(spec.names, values), locale, spec.tags) as ComponentChildren[]));
  return spec.names.length ? (...values: unknown[]) => markup(values) : markup([]);
};

const isJson = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Two pieces with the same letters or name could not be told apart: such a set falls back to English as a whole. */
const distinctPieces = (pieces: Json, english: Json): Json => {
  const out: Record<string, Json> = {};
  for (const [key, fallback] of Object.entries(english)) {
    const set = pieces[key];
    if (!isJson(fallback) || !isJson(set)) continue;
    const merged = Object.fromEntries(ROLES.map((role) => [role, usable(`pieces.${key}.${role}`, set[role], '') ? (set[role] as string) : fallback[role]]));
    const distinct = new Set(ROLES.map((role) => String(merged[role]).toLowerCase())).size === ROLES.length;
    out[key] = key === 'short' || distinct ? set : fallback;
  }
  return out;
};

/**
 * The messages of a language: each key from its locale file when the translation is usable, else from English, so a
 * language that is still being translated shows the missing messages in English.
 */
export const buildMessages = (lang: Lang, translation: Json | undefined): Messages => {
  const locale = localeOf(lang);
  const walk = (english: Json, own: Json | undefined, prefix: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(english)) {
      const path = `${prefix}${key}`;
      const mine = own?.[key];
      if (typeof value === 'string') {
        const translated = usable(path, mine, value);
        // The English text keeps the English plural rules.
        out[key] = valueOf(SPECS[path], translated ? mine : value, translated ? locale : 'en');
      } else {
        out[key] = walk(value, isJson(mine) ? mine : undefined, `${path}.`);
      }
    }
    return out;
  };
  const english = source as Json;
  const own = translation && isJson(translation.pieces) ? { ...translation, pieces: distinctPieces(translation.pieces, english.pieces as Json) } : translation;
  return { ...walk(english, own, ''), lang, locale, languageName: languageName(lang) } as unknown as Messages;
};

export const ENGLISH: Messages = buildMessages('en', undefined);

const FILES = import.meta.glob<Json>(['./locales/*.json', '!./locales/en.json'], { import: 'default' });

const loaded = new Map<Lang, Messages>([['en', ENGLISH]]);

/** Bumped when a language finishes loading, so the screens showing it render again. */
export const loads = createStore(0);

/** Fetches a language's messages once; until then (or when it fails) the site shows English. */
export const loadLanguage = async (lang: Lang): Promise<void> => {
  const file = FILES[`./locales/${lang}.json`];
  if (loaded.has(lang) || !isLang(lang) || !file) return;
  try {
    loaded.set(lang, buildMessages(lang, await file()));
    loads.set((n) => n + 1);
  } catch {}
};

/** For the prerender and the tests, which use every language. */
export const loadAllLanguages = (): Promise<unknown> => Promise.all(LANGS.map(loadLanguage));

export const messagesFor = (lang: Lang): Messages => loaded.get(lang) ?? ENGLISH;

/** Piece names in the reader's language, or the Japanese readings when the player chose them. */
export const pieceNamesFor = (t: Messages, pieceNames: 'local' | 'ja'): PieceNames => (pieceNames === 'ja' ? JAPANESE_PIECE_NAMES : t.pieces);

const listFormats = new Map<string, Intl.ListFormat>();

/** A list in the language's words ("a, b and c"). */
export const listText = (t: Messages, items: readonly string[]): string => {
  let format = listFormats.get(t.locale);
  if (!format) {
    format = new Intl.ListFormat(t.locale, { type: 'conjunction' });
    listFormats.set(t.locale, format);
  }
  return format.format(items);
};
