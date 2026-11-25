import { useT } from '../i18n/index.ts';
import logoUrl from '../assets/logo.svg';
import { SOURCE_URL } from '../source.ts';
import { COMMIT, VERSION } from '../version.ts';
import { LINKS } from '../i18n/content/shared.tsx';

const footerLink = (href: string, label: string) => {
  const external = href.startsWith('http');
  return (
    <li key={href}>
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {label}
      </a>
    </li>
  );
};

export const SiteFooter = () => {
  const t = useT();
  // The columns follow the menus at the top; the site column also holds the code and the legal pages.
  const columns: Array<{ title: string; links: Array<[string, string]> }> = [
    {
      title: t.nav.play,
      links: [
        ['/?create=lobby', t.nav.createGame],
        ['/computer', t.nav.playComputer],
        ['/tv', t.nav.liveGames],
        ['/players', t.nav.playerList],
        ['/ranking', t.nav.players],
      ],
    },
    {
      title: t.nav.learn,
      links: [
        ['/learn', t.nav.rules],
        ['/lessons', t.nav.lessons],
        ['/puzzles', t.nav.puzzles],
        ['/practice', t.nav.practice],
        ['/study', t.nav.studies],
      ],
    },
    {
      title: t.nav.tools,
      links: [
        ['/analysis', t.nav.analysis],
        ['/editor', t.nav.editor],
        ['/explorer', t.nav.explorer],
        ['/games', t.nav.gameSearch],
        ['/analysis?import', t.nav.importGame],
      ],
    },
    {
      title: t.footer.siteTitle,
      links: [
        ['/about', t.nav.about],
        ['/faq', t.nav.faq],
        ['/contact', t.nav.contact],
        [LINKS.discord, t.nav.discord],
        ['/sites', t.nav.sites],
        [LINKS.status, t.nav.status],
        [SOURCE_URL, t.footer.sourceCode],
        [LINKS.lila, t.footer.basedOnLila],
        ['/terms', t.nav.terms],
        ['/privacy', t.nav.privacy],
      ],
    },
  ];
  return (
    <footer class="ligungi-footer">
      <div class="ligungi-footer__main">
        <div class="ligungi-footer__brand">
          <a class="ligungi-footer__logo" href="/">
            <img src={logoUrl} alt="" width="32" height="32" />
            <span>
              ligungi<span class="ligungi-footer__tld">.org</span>
            </span>
          </a>
          <p>{t.footer.tagline}</p>
          <p class="ligungi-footer__studio">{t.footer.studio}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} class="ligungi-footer__column" aria-label={column.title}>
            <span class="ligungi-footer__title">{column.title}</span>
            <ul>{column.links.map(([href, label]) => footerLink(href, label))}</ul>
          </nav>
        ))}
      </div>
      <div class="ligungi-footer__bottom">
        <span>{t.footer.trademark}</span>
        <span class="ligungi-footer__version">
          v{VERSION}
          {COMMIT !== 'dev' &&
            (COMMIT.endsWith('-dirty') ? (
              ` (${COMMIT})`
            ) : (
              <>
                {' '}(
                <a href={`${SOURCE_URL}/commit/${COMMIT}`} target="_blank" rel="noopener noreferrer">
                  {COMMIT}
                </a>
                )
              </>
            ))}
        </span>
      </div>
    </footer>
  );
};
