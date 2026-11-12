import { CookiePreferences } from '../components/Consent.tsx';
import { useContent } from '../i18n/content/index.ts';
import { useT } from '../i18n/index.ts';

export const INFO_KINDS = ['about', 'faq', 'contact', 'terms', 'privacy'] as const;
export type InfoKind = (typeof INFO_KINDS)[number];

export const isInfoKind = (value: string): value is InfoKind => (INFO_KINDS as readonly string[]).includes(value);

/** About, FAQ, contact and legal pages, with lila's side menu to move between them. */
export const InfoPage = ({ kind }: { kind: InfoKind }) => {
  const t = useT();
  const content = useContent();
  const dated = kind === 'terms' || kind === 'privacy';
  return (
    <main class="page-menu ligungi-info">
      <nav class="page-menu__menu subnav">
        {INFO_KINDS.map((k) => (
          <a key={k} class={k === kind ? 'active' : ''} href={`/${k}`}>
            {t.nav[k]}
          </a>
        ))}
      </nav>
      <div class="page-menu__content box box-pad">
        <h1 class="box__top">{t.nav[kind]}</h1>
        {dated && <p class="ligungi-notice">{content.updated}</p>}
        <div class="ligungi-info__body">
          {kind === 'faq' ? (
            <dl class="ligungi-faq">
              {content.faq.map((item) => (
                <div key={item.q}>
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          ) : (
            content[kind]
          )}
          {kind === 'privacy' && <CookiePreferences />}
        </div>
      </div>
    </main>
  );
};
