import type { ComponentChildren, JSX } from 'preact';
import { SOURCE_URL } from '../../source.ts';

export const CONTACT_EMAIL = 'contato@ligungi.org';
export const REPO = SOURCE_URL;
export const STUDIO = 'https://beaterstudios.com/';

export const LINKS = {
  rulebookFaq: 'https://www.universal-music.co.jp/other/hunter-gungi__qa/',
  rulebookEnglish: 'https://planetbanatt.net/docs/gungi_rulebook_en.pdf',
  gungiWeb: 'https://gungi.2410.dev/rules.html',
  spec: `${REPO}/blob/main/docs/rules.md`,
  issues: `${REPO}/issues`,
  security: `${REPO}/security/advisories/new`,
  lila: 'https://github.com/lichess-org/lila',
  lilaCopying: 'https://github.com/lichess-org/lila/blob/master/COPYING.md',
  ofl: 'https://openfontlicense.org/',
  agpl: `${REPO}/blob/main/LICENSE`,
  cloudflarePrivacy: 'https://www.cloudflare.com/privacypolicy/',
  status: 'https://beaterstudios.betteruptime.com/',
} as const;

/** External link, opened in a new tab. */
export const Ext = ({ href, children }: { href: string; children: ComponentChildren }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export interface FaqItem {
  readonly q: string;
  readonly a: JSX.Element;
}

export interface Content {
  readonly updated: string;
  readonly about: JSX.Element;
  readonly faq: readonly FaqItem[];
  readonly contact: JSX.Element;
  readonly terms: JSX.Element;
  readonly privacy: JSX.Element;
  readonly sources: JSX.Element;
}
