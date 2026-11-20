/** The languages the site offers (translated enough, see scripts/languages.ts), by their own names. Set at build time. */
declare const __LIGUNGI_LANGUAGES__: ReadonlyArray<{ readonly code: string; readonly locale: string; readonly name: string }>;

export type Language = (typeof __LIGUNGI_LANGUAGES__)[number];

export const LANGUAGES: readonly Language[] = __LIGUNGI_LANGUAGES__;

/** A language code: the name of its locale file, in URLs (`?lang=`) and in the preferences. */
export type Lang = string;

export const LANGS: readonly Lang[] = LANGUAGES.map((language) => language.code);

const byCode = new Map(LANGUAGES.map((language) => [language.code, language]));

export const isLang = (value: unknown): value is Lang => typeof value === 'string' && byCode.has(value);

/** The language's BCP 47 tag, for `lang` attributes and `Intl`. */
export const localeOf = (lang: Lang): string => byCode.get(lang)?.locale ?? lang;

/** The language's name in itself ("Português"). */
export const languageName = (lang: Lang): string => byCode.get(lang)?.name ?? lang;

/** The offered language for a browser language tag: the same tag, else the same base language. */
export const matchLang = (tag: string): Lang | undefined => {
  const lower = tag.toLowerCase();
  const base = lower.split('-')[0];
  return (
    LANGS.find((lang) => lang.toLowerCase() === lower || localeOf(lang).toLowerCase() === lower) ??
    LANGS.find((lang) => lang.toLowerCase().split('-')[0] === base)
  );
};
