import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A language of the site: the code in URLs and preferences (the locale file's name), its BCP 47 tag and its own name. */
export interface Language {
  readonly code: string;
  readonly locale: string;
  readonly name: string;
  /** Share of the English messages the locale file translates, from 0 to 1. */
  readonly coverage: number;
}

/** A language is offered once this share of the messages is translated; the rest falls back to English. */
export const MIN_COVERAGE = 0.8;

/** Codes whose language tag is not the code itself: the Portuguese translation is Brazilian. */
const LOCALES: Readonly<Record<string, string>> = { pt: 'pt-BR' };

type Json = { readonly [key: string]: unknown };

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** How many of the English strings the translation fills, and how many there are. */
const count = (english: Json, translation: unknown): [number, number] => {
  let done = 0;
  let total = 0;
  for (const [key, value] of Object.entries(english)) {
    const own = isObject(translation) ? translation[key] : undefined;
    if (isObject(value)) {
      const [d, t] = count(value, own);
      done += d;
      total += t;
    } else {
      total++;
      if (typeof own === 'string' && own.trim() !== '') done++;
    }
  }
  return [done, total];
};

const nameOf = (code: string, locale: string): string => {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
};

/** Every locale file in `dir`, with how much of it is translated. */
export const languages = (dir: string): Language[] => {
  const read = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const english = read('en.json') as Json;
  return readdirSync(dir)
    .filter((file) => /^[a-z]{2,3}(-[A-Za-z0-9]+)*\.json$/.test(file))
    .map((file) => {
      const code = file.slice(0, -'.json'.length);
      const locale = LOCALES[code] ?? code;
      const [done, total] = count(english, read(file));
      return { code, locale, name: nameOf(code, locale), coverage: total ? done / total : 0 };
    });
};

/** The languages the site offers, by their own names. */
export const offeredLanguages = (dir: string): Language[] =>
  languages(dir)
    .filter((language) => language.code === 'en' || language.coverage >= MIN_COVERAGE)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
