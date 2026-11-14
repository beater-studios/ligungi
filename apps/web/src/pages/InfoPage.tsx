import { useEffect } from 'preact/hooks';
import { CookiePreferences } from '../components/Consent.tsx';
import { useContent } from '../i18n/content/index.ts';
import { useT } from '../i18n/index.ts';

export const INFO_KINDS = ['about', 'faq', 'contact', 'terms', 'privacy'] as const;
export type InfoKind = (typeof INFO_KINDS)[number];

export const isInfoKind = (value: string): value is InfoKind => (INFO_KINDS as readonly string[]).includes(value);

/** About, FAQ, contact and legal pages: a menu between them beside (on phones above) the article. */
export const InfoPage = ({ kind }: { kind: InfoKind }) => {
  const t = useT();
  const content = useContent();
  const dated = kind === 'terms' || kind === 'privacy';
  // On phones the menu is a row that scrolls sideways: centre the current page's chip by scrolling the row only, never the page.
  useEffect(() => {
    const menu = document.querySelector<HTMLElement>('.ligungi-info__menu');
    const active = menu?.querySelector<HTMLElement>('a.active');
    if (menu && active) menu.scrollLeft = active.offsetLeft - menu.offsetLeft - (menu.clientWidth - active.offsetWidth) / 2;
  }, [kind]);
  return (
    <main class="ligungi-page ligungi-info">
      <nav class="ligungi-card ligungi-info__menu" aria-label={t.info.pages}>
        {INFO_KINDS.map((k) => (
          <a key={k} class={k === kind ? 'active' : ''} href={`/${k}`} aria-current={k === kind ? 'page' : undefined}>
            {t.nav[k]}
          </a>
        ))}
      </nav>
      <article class="ligungi-card ligungi-info__article">
        <h1>{t.nav[kind]}</h1>
        {dated && <p class="ligungi-notice">{content.updated}</p>}
        <div class="ligungi-info__body">
          {kind === 'faq' ? (
            <div class="ligungi-faq">
              {content.faq.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>{item.q}</summary>
                  <div class="ligungi-faq__answer">{item.a}</div>
                </details>
              ))}
            </div>
          ) : (
            content[kind]
          )}
          {kind === 'privacy' && <CookiePreferences />}
        </div>
      </article>
    </main>
  );
};
