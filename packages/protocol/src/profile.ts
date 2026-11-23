import type { ErrorCode } from './errors.ts';

/** ISO 3166-1 alpha-2 codes, lowercase, each with a flag in the site. Names come from the browser in the page's language. */
export const COUNTRIES = [
  'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'ao', 'aq', 'ar', 'as', 'at', 'au', 'aw', 'ax', 'az', 'ba', 'bb', 'bd',
  'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bl', 'bm', 'bn', 'bo', 'bq', 'br', 'bs', 'bt', 'bv', 'bw', 'by', 'bz', 'ca',
  'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv', 'cw', 'cx', 'cy', 'cz', 'de',
  'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'eh', 'er', 'es', 'et', 'fi', 'fj', 'fk', 'fm', 'fo', 'fr', 'ga',
  'gb', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq', 'gr', 'gs', 'gt', 'gu', 'gw', 'gy', 'hk',
  'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im', 'in', 'io', 'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'jp',
  'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt',
  'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mf', 'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms',
  'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz',
  'om', 'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs',
  'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st',
  'sv', 'sx', 'sy', 'sz', 'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tr', 'tt', 'tv', 'tw',
  'tz', 'ua', 'ug', 'um', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu', 'wf', 'ws', 'ye', 'yt', 'za',
  'zm', 'zw'
] as const;
export type Country = (typeof COUNTRIES)[number];

export const PROFILE_BIO_MAX = 400;

/** A name on another lila-based site: 2 to 30 letters, digits, `_` or `-`, starting and ending with a letter or digit. */
const LILA_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,28}[A-Za-z0-9])?$/;

/**
 * The profiles a player may link: social networks and other games. The player types only their name on the site and
 * ligungi builds the address, so a profile can never point anywhere else.
 */
export const PROFILE_LINKS = {
  youtube: { group: 'social', prefix: 'youtube.com/@', pattern: /^[A-Za-z0-9._-]{3,30}$/ },
  twitch: { group: 'social', prefix: 'twitch.tv/', pattern: /^[A-Za-z0-9_]{4,25}$/ },
  instagram: { group: 'social', prefix: 'instagram.com/', pattern: /^[A-Za-z0-9._]{1,30}$/ },
  x: { group: 'social', prefix: 'x.com/', pattern: /^[A-Za-z0-9_]{1,15}$/ },
  tiktok: { group: 'social', prefix: 'tiktok.com/@', pattern: /^[A-Za-z0-9._]{2,24}$/ },
  bluesky: { group: 'social', prefix: 'bsky.app/profile/', pattern: /^(?=.{3,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/ },
  reddit: { group: 'social', prefix: 'reddit.com/user/', pattern: /^[A-Za-z0-9_-]{3,20}$/ },
  github: { group: 'social', prefix: 'github.com/', pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/ },
  lichess: { group: 'games', prefix: 'lichess.org/@/', pattern: LILA_NAME },
  lishogi: { group: 'games', prefix: 'lishogi.org/@/', pattern: LILA_NAME },
  lidraughts: { group: 'games', prefix: 'lidraughts.org/@/', pattern: LILA_NAME },
  libaduk: { group: 'games', prefix: 'libaduk.com/profile/', pattern: LILA_NAME },
} as const satisfies Record<string, { readonly group: 'social' | 'games'; readonly prefix: string; readonly pattern: RegExp }>;
export type ProfileSite = keyof typeof PROFILE_LINKS;
export const PROFILE_SITES = Object.keys(PROFILE_LINKS) as ProfileSite[];

/** What a player tells about themselves on their profile. Every field is public. */
export interface ProfileDetails {
  readonly bio: string;
  readonly country: Country | null;
  /** Their name on each site, in `PROFILE_SITES` order. */
  readonly links: Readonly<Partial<Record<ProfileSite, string>>>;
}

export const EMPTY_PROFILE: ProfileDetails = { bio: '', country: null, links: {} };

export const profileLinkUrl = (site: ProfileSite, name: string): string => `https://${PROFILE_LINKS[site].prefix}${name}`;

/**
 * The name typed for a site, forgiving what people paste: the full address (with or without `https://` and `www.`),
 * a leading `@` and a trailing slash are dropped. `null` when what is left is not a valid name there.
 */
export const profileLinkName = (site: ProfileSite, typed: string): string | null => {
  const { prefix, pattern } = PROFILE_LINKS[site];
  let name = typed.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (name.toLowerCase().startsWith(prefix.toLowerCase())) name = name.slice(prefix.length);
  name = name.replace(/^@/, '').replace(/\/+$/, '');
  return pattern.test(name) ? name : null;
};

/** The bio as stored: line breaks kept (at most one blank line in a row), other control characters removed, trimmed. */
export const normalizeBio = (bio: string): string =>
  bio
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRIES);

/** Validates the profile a player saves. Returns an error code when invalid. */
export const parseProfileDetails = (input: unknown): ProfileDetails | ErrorCode => {
  if (typeof input !== 'object' || input === null) return 'invalidProfile';
  const value = input as Record<string, unknown>;
  if (typeof value.bio !== 'string') return 'invalidProfile';
  const bio = normalizeBio(value.bio);
  if ([...bio].length > PROFILE_BIO_MAX) return 'bioTooLong';
  if (value.country !== null && !COUNTRY_SET.has(value.country as string)) return 'invalidCountry';
  if (typeof value.links !== 'object' || value.links === null) return 'invalidProfile';
  const typed = value.links as Record<string, unknown>;
  const links: Partial<Record<ProfileSite, string>> = {};
  for (const key of Object.keys(typed)) if (!Object.hasOwn(PROFILE_LINKS, key)) return 'invalidProfileLink';
  for (const site of PROFILE_SITES) {
    const text = typed[site];
    if (text === undefined || text === '') continue;
    if (typeof text !== 'string') return 'invalidProfileLink';
    const name = profileLinkName(site, text);
    if (name === null) return 'invalidProfileLink';
    links[site] = name;
  }
  return { bio, country: (value.country as Country | null), links };
};
